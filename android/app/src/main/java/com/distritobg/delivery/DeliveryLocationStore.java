package com.distritobg.delivery;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.util.ArrayList;
import java.util.List;

final class DeliveryLocationStore extends SQLiteOpenHelper {
    static final String PREFS_NAME = "delivery_location_secure";
    private final SharedPreferences preferences;

    DeliveryLocationStore(Context context) {
        super(context, "delivery_location_queue.db", null, 1);
        try {
            MasterKey key = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            preferences = EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    key,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception error) {
            throw new IllegalStateException("No fue posible inicializar el almacenamiento seguro", error);
        }
    }

    @Override
    public void onCreate(SQLiteDatabase database) {
        database.execSQL("CREATE TABLE location_queue (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)");
        database.execSQL("CREATE INDEX location_queue_created_idx ON location_queue(created_at)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
        // Primera versión. Las siguientes migraciones deben conservar siempre la cola sin enviar.
    }

    SharedPreferences prefs() {
        return preferences;
    }

    synchronized void enqueue(String id, String payload, int limit) {
        SQLiteDatabase database = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("id", id);
        values.put("payload", payload);
        values.put("created_at", System.currentTimeMillis());
        database.insertWithOnConflict("location_queue", null, values, SQLiteDatabase.CONFLICT_IGNORE);
        int overflow = Math.max(0, count() - Math.max(100, limit));
        if (overflow > 0) {
            database.execSQL("DELETE FROM location_queue WHERE id IN (SELECT id FROM location_queue ORDER BY created_at ASC LIMIT " + overflow + ")");
        }
    }

    synchronized List<QueuedPoint> first(int limit) {
        List<QueuedPoint> points = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
                "location_queue", new String[]{"id", "payload"}, null, null,
                null, null, "created_at ASC", String.valueOf(Math.min(Math.max(limit, 1), 100)))) {
            while (cursor.moveToNext()) points.add(new QueuedPoint(cursor.getString(0), cursor.getString(1)));
        }
        return points;
    }

    synchronized void remove(List<QueuedPoint> points) {
        SQLiteDatabase database = getWritableDatabase();
        database.beginTransaction();
        try {
            for (QueuedPoint point : points) database.delete("location_queue", "id=?", new String[]{point.id});
            database.setTransactionSuccessful();
        } finally {
            database.endTransaction();
        }
    }

    synchronized int count() {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM location_queue", null)) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    static final class QueuedPoint {
        final String id;
        final String payload;

        QueuedPoint(String id, String payload) {
            this.id = id;
            this.payload = payload;
        }
    }
}
