package com.distritobg.delivery;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "Navigation")
public class NavigationPlugin extends Plugin {

    private static final String GOOGLE_MAPS_PACKAGE = "com.google.android.apps.maps";
    private static final String WAZE_PACKAGE = "com.waze";

    @PluginMethod
    public void isGoogleMapsAvailable(PluginCall call) {
        boolean available = isPackageInstalled(GOOGLE_MAPS_PACKAGE);
        JSObject ret = new JSObject();
        ret.put("available", available);
        call.resolve(ret);
    }

    @PluginMethod
    public void isWazeAvailable(PluginCall call) {
        boolean available = isPackageInstalled(WAZE_PACKAGE);
        JSObject ret = new JSObject();
        ret.put("available", available);
        call.resolve(ret);
    }

    @PluginMethod
    public void openGoogleMaps(PluginCall call) {
        Double latitude = call.getDouble("latitude");
        Double longitude = call.getDouble("longitude");
        String address = call.getString("address", "");

        JSObject result = new JSObject();

        try {
            boolean hasCoords = latitude != null && longitude != null;
            String queryTarget = hasCoords
                    ? (latitude + "," + longitude)
                    : URLEncoder.encode(address, StandardCharsets.UTF_8.name());

            if (isPackageInstalled(GOOGLE_MAPS_PACKAGE)) {
                Uri navUri = Uri.parse("google.navigation:q=" + queryTarget + "&mode=d");
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, navUri);
                mapIntent.setPackage(GOOGLE_MAPS_PACKAGE);
                mapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                Context context = getContext();
                if (mapIntent.resolveActivity(context.getPackageManager()) != null) {
                    context.startActivity(mapIntent);
                    result.put("success", true);
                    result.put("opened", "google_maps");
                    result.put("fallback", false);
                    call.resolve(result);
                    return;
                }
            }

            // Fallback Web: si Google Maps no está instalado o el intent no resolvió
            String webUrl = "https://www.google.com/maps/dir/?api=1&destination=" + queryTarget + "&travelmode=driving";
            Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(webUrl));
            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(webIntent);

            result.put("success", true);
            result.put("opened", "browser");
            result.put("fallback", true);
            call.resolve(result);

        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage() != null ? e.getMessage() : "Error al abrir Google Maps");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void openWaze(PluginCall call) {
        Double latitude = call.getDouble("latitude");
        Double longitude = call.getDouble("longitude");
        String address = call.getString("address", "");

        JSObject result = new JSObject();

        try {
            boolean hasCoords = latitude != null && longitude != null;

            if (isPackageInstalled(WAZE_PACKAGE)) {
                String uriStr = hasCoords
                        ? "waze://?ll=" + latitude + "," + longitude + "&navigate=yes"
                        : "waze://?q=" + URLEncoder.encode(address, StandardCharsets.UTF_8.name()) + "&navigate=yes";

                Uri wazeUri = Uri.parse(uriStr);
                Intent wazeIntent = new Intent(Intent.ACTION_VIEW, wazeUri);
                wazeIntent.setPackage(WAZE_PACKAGE);
                wazeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                Context context = getContext();
                if (wazeIntent.resolveActivity(context.getPackageManager()) != null) {
                    context.startActivity(wazeIntent);
                    result.put("success", true);
                    result.put("opened", "waze");
                    result.put("fallback", false);
                    call.resolve(result);
                    return;
                }
            }

            // Fallback Web: si Waze no está instalado o el intent no resolvió
            String webUrl = hasCoords
                    ? "https://waze.com/ul?ll=" + latitude + "," + longitude + "&navigate=yes"
                    : "https://waze.com/ul?q=" + URLEncoder.encode(address, StandardCharsets.UTF_8.name()) + "&navigate=yes";

            Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(webUrl));
            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(webIntent);

            result.put("success", true);
            result.put("opened", "browser");
            result.put("fallback", true);
            call.resolve(result);

        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage() != null ? e.getMessage() : "Error al abrir Waze");
            call.resolve(result);
        }
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
