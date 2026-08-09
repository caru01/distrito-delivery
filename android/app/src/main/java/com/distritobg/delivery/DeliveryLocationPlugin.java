package com.distritobg.delivery;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;

import java.net.URI;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
        name = "DeliveryLocation",
        permissions = {
                @Permission(alias = "location", strings = {
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.ACCESS_FINE_LOCATION
                }),
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
        }
)
public class DeliveryLocationPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        if (!isTrustedBridgeContext(call)) return;
        String apiUrl = call.getString("apiUrl", "");
        String bootstrapCode = call.getString("bootstrapCode", "");
        String deviceId = call.getString("deviceId", "");
        if (apiUrl.isEmpty() || bootstrapCode.isEmpty() || deviceId.isEmpty()) {
            call.reject("Falta la configuración segura del servicio GPS", "INVALID_CONFIGURATION");
            return;
        }
        if (!BuildConfig.DEBUG && !isProductionApiUrl(apiUrl)) {
            call.reject("El Release rechazó una API diferente a producción", "UNTRUSTED_API_URL");
            return;
        }
        Intent intent = new Intent(getContext(), DeliveryLocationService.class);
        intent.setAction(DeliveryLocationService.ACTION_START);
        intent.putExtra(DeliveryLocationService.EXTRA_API_URL, apiUrl);
        intent.putExtra(DeliveryLocationService.EXTRA_BOOTSTRAP_CODE, bootstrapCode);
        intent.putExtra(DeliveryLocationService.EXTRA_DEVICE_ID, deviceId);
        intent.putExtra(DeliveryLocationService.EXTRA_MODE, call.getString("mode", "FREE"));
        intent.putExtra(DeliveryLocationService.EXTRA_DELIVERY_INTERVAL, call.getInt("deliveryIntervalSeconds", 7));
        intent.putExtra(DeliveryLocationService.EXTRA_FREE_INTERVAL, call.getInt("freeIntervalSeconds", 45));
        intent.putExtra(DeliveryLocationService.EXTRA_QUEUE_LIMIT, call.getInt("queueLimit", 2000));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve(status());
    }

    @PluginMethod
    public void setMode(PluginCall call) {
        if (!isTrustedBridgeContext(call)) return;
        Intent intent = new Intent(getContext(), DeliveryLocationService.class);
        intent.setAction(DeliveryLocationService.ACTION_MODE);
        intent.putExtra(DeliveryLocationService.EXTRA_MODE, call.getString("mode", "FREE"));
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve(status());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (!isTrustedBridgeContext(call)) return;
        Intent intent = new Intent(getContext(), DeliveryLocationService.class);
        intent.setAction(DeliveryLocationService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        if (!isTrustedBridgeContext(call)) return;
        call.resolve(status());
    }

    @PluginMethod
    public void getLastKnownLocation(PluginCall call) {
        if (!isTrustedBridgeContext(call)) return;
        JSObject result = status();
        call.resolve(result);
    }

    private JSObject status() {
        DeliveryLocationStore store = new DeliveryLocationStore(getContext());
        JSObject result = new JSObject();
        result.put("running", store.prefs().getBoolean("running", false));
        result.put("mode", store.prefs().getString("mode", "OFF"));
        result.put("lastCaptureAt", store.prefs().getLong("last_capture", 0));
        result.put("lastSyncedAt", store.prefs().getLong("last_sync", 0));
        result.put("latitude", parseCoordinate(store.prefs().getString("last_latitude", "")));
        result.put("longitude", parseCoordinate(store.prefs().getString("last_longitude", "")));
        result.put("accuracy", store.prefs().getFloat("last_accuracy", -1f));
        result.put("pending", store.count());
        LocationManager locationManager = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        boolean permissionGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean locationEnabled = false;
        if (locationManager != null) {
            locationEnabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? locationManager.isLocationEnabled()
                    : locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                      || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        }
        result.put("permissionGranted", permissionGranted);
        result.put("locationEnabled", locationEnabled);
        result.put("error", !permissionGranted ? "PERMISO GPS REVOCADO"
                : !locationEnabled ? "GPS DESACTIVADO"
                : store.prefs().getString("error", ""));
        store.close();
        return result;
    }

    private boolean isTrustedBridgeContext(PluginCall call) {
        String url = getBridge() == null || getBridge().getWebView() == null
                ? "" : String.valueOf(getBridge().getWebView().getUrl());
        boolean trusted = url.startsWith(BuildConfig.TRUSTED_WEBVIEW_ORIGIN);
        if (!trusted) call.reject("El bridge GPS solo está disponible para la interfaz instalada", "UNTRUSTED_BRIDGE_CONTEXT");
        return trusted;
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

    private Object parseCoordinate(String value) {
        try {
            return Double.parseDouble(value);
        } catch (Exception ignored) {
            return org.json.JSONObject.NULL;
        }
    }
}
