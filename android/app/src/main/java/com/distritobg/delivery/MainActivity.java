package com.distritobg.delivery;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeliveryLocationPlugin.class);
        registerPlugin(NavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
