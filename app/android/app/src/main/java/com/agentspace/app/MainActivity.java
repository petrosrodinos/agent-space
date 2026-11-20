package com.agentspace.app;

import android.os.Bundle;
import com.agentspace.app.voice.VoicePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app plugins (app/src/platform/mobile-native.ts, mobile-voice.ts) must be registered before the bridge
        // loads. BridgeActivity also hands the launch intent to plugins, so a cold-start share reaches the share plugin.
        registerPlugin(AgentSpacePlugin.class);
        registerPlugin(VoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
