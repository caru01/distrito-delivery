package com.distritobg.delivery;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class DeliveryLocationService extends Service {
    static final String ACTION_START = "com.distritobg.delivery.location.START";
    static final String ACTION_STOP = "com.distritobg.delivery.location.STOP";
    static final String ACTION_MODE = "com.distritobg.delivery.location.MODE";
    static final String EXTRA_API_URL = "apiUrl";
    static final String EXTRA_BOOTSTRAP_CODE = "bootstrapCode";
    static final String EXTRA_DEVICE_ID = "deviceId";
    static final String EXTRA_MODE = "mode";
    static final String EXTRA_DELIVERY_INTERVAL = "deliveryInterval";
    static final String EXTRA_FREE_INTERVAL = "freeInterval";
    static final String EXTRA_QUEUE_LIMIT = "queueLimit";

    private static final String CHANNEL_ID = "delivery_tracking";
    private static final int NOTIFICATION_ID = 2031;
    private DeliveryLocationStore store;
    private SharedPreferences prefs;
    private FusedLocationProviderClient locationClient;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean flushing = new AtomicBoolean(false);

    private final LocationCallback callback = new LocationCallback() {
        @Override
        public void onLocationResult(LocationResult result) {
            Location location = result.getLastLocation();
            if (location != null) persistAndFlush(location);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        store = new DeliveryLocationStore(getApplicationContext());
        prefs = store.prefs();
        locationClient = LocationServices.getFusedLocationProviderClient(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTracking();
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_START.equals(action)) saveConfiguration(intent);
        if (intent != null && ACTION_MODE.equals(action)) {
            prefs.edit().putString("mode", safeMode(intent.getStringExtra(EXTRA_MODE))).apply();
        }
        if (!hasConfiguration()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startAsForeground();
        startLocationUpdates();
        flushQueue();
        return START_STICKY;
    }

    private void saveConfiguration(Intent intent) {
        prefs.edit()
                .putString("api_url", intent.getStringExtra(EXTRA_API_URL))
                .putString("bootstrap_code", intent.getStringExtra(EXTRA_BOOTSTRAP_CODE))
                .remove("tracking_token")
                .putString("device_id", intent.getStringExtra(EXTRA_DEVICE_ID))
                .putString("mode", safeMode(intent.getStringExtra(EXTRA_MODE)))
                .putInt("delivery_interval", Math.max(3, intent.getIntExtra(EXTRA_DELIVERY_INTERVAL, 7)))
                .putInt("free_interval", Math.max(15, intent.getIntExtra(EXTRA_FREE_INTERVAL, 45)))
                .putInt("queue_limit", Math.max(100, intent.getIntExtra(EXTRA_QUEUE_LIMIT, 2000)))
                .putBoolean("running", true)
                .putString("error", "")
                .apply();
    }

    private boolean hasConfiguration() {
        String apiUrl = prefs.getString("api_url", "");
        return prefs.getBoolean("running", false)
                && !apiUrl.isEmpty()
                && (BuildConfig.DEBUG || isProductionApiUrl(apiUrl))
                && (!prefs.getString("tracking_token", "").isEmpty()
                    || !prefs.getString("bootstrap_code", "").isEmpty());
    }

    private boolean isProductionApiUrl(String value) {
        try {
            URI uri = new URI(value.replaceAll("/+$", ""));
            URI expected = new URI(BuildConfig.PRODUCTION_API_URL + "/api/pedidos");
            return "https".equalsIgnoreCase(uri.getScheme())
                    && expected.getHost().equalsIgnoreCase(uri.getHost())
                    && uri.getPort() == -1
                    && expected.getPath().equals(uri.getPath())
                    && uri.getUserInfo() == null
                    && uri.getQuery() == null
                    && uri.getFragment() == null;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String safeMode(String value) {
        return "DELIVERY".equalsIgnoreCase(value) ? "DELIVERY" : "FREE";
    }

    private void startAsForeground() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String mode = prefs.getString("mode", "FREE");
        String text = "DELIVERY".equals(mode)
                ? "Entrega activa · ubicación en tiempo real"
                : "Turno activo · ubicación de disponibilidad";
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("DistritoBG Delivery")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Seguimiento de entregas", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantiene la ubicación activa durante el turno del domiciliario");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private void startLocationUpdates() {
        locationClient.removeLocationUpdates(callback);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            prefs.edit().putString("error", "Permiso de ubicación no concedido").apply();
            stopSelf();
            return;
        }
        String mode = prefs.getString("mode", "FREE");
        long seconds = "DELIVERY".equals(mode)
                ? prefs.getInt("delivery_interval", 7)
                : prefs.getInt("free_interval", 45);
        LocationRequest request = new LocationRequest.Builder(
                "DELIVERY".equals(mode) ? Priority.PRIORITY_HIGH_ACCURACY : Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                seconds * 1000L)
                .setMinUpdateIntervalMillis(Math.max(2000L, seconds * 700L))
                .setMaxUpdateDelayMillis(seconds * 2000L)
                .build();
        try {
            locationClient.requestLocationUpdates(request, callback, getMainLooper());
            prefs.edit().putBoolean("running", true).putString("error", "").apply();
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification());
        } catch (SecurityException error) {
            prefs.edit().putString("error", "Android bloqueó el acceso a la ubicación").apply();
            stopSelf();
        }
    }

    private void persistAndFlush(Location location) {
        try {
            String id = UUID.randomUUID().toString();
            JSONObject point = new JSONObject();
            point.put("id", id);
            point.put("latitude", location.getLatitude());
            point.put("longitude", location.getLongitude());
            point.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
            point.put("speed", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
            point.put("bearing", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            point.put("altitude", location.hasAltitude() ? location.getAltitude() : JSONObject.NULL);
            point.put("capturedAt", isoDate(location.getTime()));
            point.put("mode", prefs.getString("mode", "FREE"));
            point.put("provider", location.getProvider() == null ? "android-fused" : "android-" + location.getProvider());
            store.enqueue(id, point.toString(), prefs.getInt("queue_limit", 2000));
            prefs.edit()
                    .putLong("last_capture", location.getTime())
                    .putString("last_latitude", String.valueOf(location.getLatitude()))
                    .putString("last_longitude", String.valueOf(location.getLongitude()))
                    .putFloat("last_accuracy", location.hasAccuracy() ? location.getAccuracy() : -1f)
                    .apply();
            flushQueue();
        } catch (Exception error) {
            prefs.edit().putString("error", "No fue posible guardar la ubicación").apply();
        }
    }

    private String isoDate(long timestamp) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(timestamp));
    }

    private void flushQueue() {
        if (!flushing.compareAndSet(false, true)) return;
        networkExecutor.execute(() -> {
            try {
                List<DeliveryLocationStore.QueuedPoint> batch = store.first(100);
                while (!batch.isEmpty() && prefs.getBoolean("running", false)) {
                    JSONArray points = new JSONArray();
                    for (DeliveryLocationStore.QueuedPoint point : batch) points.put(new JSONObject(point.payload));
                    JSONObject body = new JSONObject().put("points", points);
                    int status = postBatch(body.toString());
                    if (status >= 200 && status < 300) {
                        store.remove(batch);
                        prefs.edit().putLong("last_sync", System.currentTimeMillis()).putString("error", "").apply();
                        batch = store.first(100);
                    } else {
                        if (status == 401 || status == 403) {
                            prefs.edit().putString("error", "La autorización GPS expiró; abre la aplicación para renovarla").apply();
                        }
                        break;
                    }
                }
            } catch (Exception error) {
                prefs.edit().putString("error", "Sin conexión: el recorrido está guardado en el dispositivo").apply();
            } finally {
                flushing.set(false);
            }
        });
    }

    private int postBatch(String body) throws Exception {
        String apiUrl = prefs.getString("api_url", "").replaceAll("/+$", "");
        if (prefs.getString("tracking_token", "").isEmpty() && !exchangeBootstrap(apiUrl)) return 401;
        HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl + "/delivery/native/location/batch").openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Authorization", "Bearer " + prefs.getString("tracking_token", ""));
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setDoOutput(true);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        connection.disconnect();
        return status;
    }

    private boolean exchangeBootstrap(String apiUrl) throws Exception {
        String bootstrapCode = prefs.getString("bootstrap_code", "");
        String deviceId = prefs.getString("device_id", "");
        if (bootstrapCode.isEmpty() || deviceId.isEmpty()) return false;
        HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl + "/delivery/native/exchange").openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setDoOutput(true);
        String requestBody = new JSONObject()
                .put("bootstrapCode", bootstrapCode)
                .put("deviceId", deviceId)
                .toString();
        try (OutputStream output = connection.getOutputStream()) {
            output.write(requestBody.getBytes(StandardCharsets.UTF_8));
        }
        if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
            connection.disconnect();
            return false;
        }
        StringBuilder response = new StringBuilder();
        try (InputStream input = connection.getInputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) response.append(new String(buffer, 0, read, StandardCharsets.UTF_8));
        }
        connection.disconnect();
        String token = new JSONObject(response.toString()).optString("trackingToken", "");
        if (token.isEmpty()) return false;
        prefs.edit().putString("tracking_token", token).remove("bootstrap_code").putString("error", "").apply();
        return true;
    }

    private void stopTracking() {
        locationClient.removeLocationUpdates(callback);
        prefs.edit().putBoolean("running", false).remove("tracking_token").remove("bootstrap_code").putString("mode", "OFF").apply();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        locationClient.removeLocationUpdates(callback);
        networkExecutor.shutdown();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
