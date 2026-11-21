package com.ventlog.free;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int REQUEST_SPEECH = 100;
    private static final int REQUEST_CREATE_DOCUMENT = 101;
    private static final int REQUEST_PICK_FILE = 102;
    private WebView webView;
    private String pendingDocument = "";
    private ValueCallback<Uri[]> fileCallback;
    private String sharedText;
    private boolean pageReady = false;
    private String pendingWidgetMode;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16, 21, 34));
        getWindow().setNavigationBarColor(Color.rgb(16, 21, 34));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 21, 34));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Required for user-selected journal backup imports
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        webView.addJavascriptInterface(new AppBridge(), "VentlogAndroid");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       WebChromeClient.FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), REQUEST_PICK_FILE); }
                catch (Exception error) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    show("File picker is unavailable.");
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) {
                    String path = url.getPath();
                    if (path == null || path.length() < 2 || path.contains("..")) return notFound();
                    String asset = path.substring(1);
                    try {
                        InputStream data = getAssets().open(asset);
                        String mime = asset.endsWith(".css") ? "text/css" :
                                      asset.endsWith(".js") ? "application/javascript" :
                                      asset.endsWith(".png") ? "image/png" :
                                      asset.endsWith(".webmanifest") ? "application/manifest+json" :
                                      asset.endsWith(".html") ? "text/html" : "text/plain";
                        return new WebResourceResponse(mime, "UTF-8", data);
                    } catch (Exception ignored) { return notFound(); }
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternal(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternal(Uri.parse(url));
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (HOME.equals(url)) {
                    pageReady = true;
                    applySharedText();
                    applyWidgetStart();
                }
            }
        });
        setContentView(webView);
        receiveShare(getIntent());
        queueWidgetStart(getIntent());
        webView.loadUrl(HOME);
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null,
                new ByteArrayInputStream(new byte[0]));
    }

    private boolean handleExternal(Uri url) {
        if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) return false;
        String scheme = url.getScheme();
        if ("https".equals(scheme) || "http".equals(scheme)) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                startActivity(intent);
            } catch (Exception error) { show("No browser available to open this link."); }
        }
        return true;
    }

    private final class AppBridge {
        @JavascriptInterface public void perform(String action, String json) {
            if (json == null || json.length() > 200000 || action == null) return;
            try {
                JSONObject body = new JSONObject(json);
                runOnUiThread(() -> performAction(action, body));
            } catch (Exception ignored) { runOnUiThread(() -> show("Could not process that action.")); }
        }
    }

    private void performAction(String action, JSONObject params) {
        String text = params.optString("text", "");
        switch (action) {
            case "copy":
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("Ventlog text", text));
                break;
            case "speech":
                try {
                    Intent speech = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE, params.optString("lang", "en-PH"));
                    speech.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your rant");
                    startActivityForResult(speech, REQUEST_SPEECH);
                } catch (Exception error) { show("Voice input unavailable. Try your keyboard microphone."); }
                break;
            case "save":
                pendingDocument = text;
                try {
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType("text/plain");
                    String requested = params.optString("name", "ventlog.txt");
                    save.putExtra(Intent.EXTRA_TITLE, requested.endsWith(".txt") || requested.endsWith(".json") ? requested : requested + ".txt");
                    startActivityForResult(save, REQUEST_CREATE_DOCUMENT);
                } catch (Exception error) { show("No file picker found. Share the text instead."); }
                break;
            case "open":
                Uri destination = Uri.parse(params.optString("url", ""));
                handleExternal(destination);
                break;
            case "share":
                try {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, "Share Ventlog entry"));
                } catch (Exception error) { show("Sharing is unavailable on this phone."); }
                break;
            default: break;
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PICK_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        if (resultCode != RESULT_OK || data == null) return;
        if (requestCode == REQUEST_SPEECH) {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (matches != null && !matches.isEmpty()) js("window.ventlogNativeSpeechResult(" + JSONObject.quote(matches.get(0)) + ");");
        } else if (requestCode == REQUEST_CREATE_DOCUMENT) {
            Uri destination = data.getData();
            if (destination == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(destination)) {
                if (out == null) throw new IllegalStateException("No writable stream");
                out.write(pendingDocument.getBytes(StandardCharsets.UTF_8));
                show("File saved.");
            } catch (Exception error) { show("Could not save file. Try again or share as text."); }
            finally { pendingDocument = ""; }
        }
    }

    private void js(String code) {
        if (webView != null && pageReady) webView.evaluateJavascript(code, null);
    }
    private void receiveShare(Intent input) {
        if (input != null && Intent.ACTION_SEND.equals(input.getAction()) && "text/plain".equals(input.getType())) {
            CharSequence received = input.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (received != null) sharedText = received.toString();
        }
    }
    private void applySharedText() {
        if (pageReady && sharedText != null) {
            js("window.ventlogNativeSharedText(" + JSONObject.quote(sharedText) + ");");
            sharedText = null;
        }
    }
    private void queueWidgetStart(Intent input) {
        if (input == null) return;
        String action = input.getAction();
        if (VentlogWidgetProvider.ACTION_VOICE.equals(action)) pendingWidgetMode = "voice";
        else if (VentlogWidgetProvider.ACTION_TYPE.equals(action)) pendingWidgetMode = "type";
        applyWidgetStart();
    }

    private void applyWidgetStart() {
        if (!pageReady || pendingWidgetMode == null) return;
        String mode = pendingWidgetMode;
        pendingWidgetMode = null;
        js("if(window.ventlogWidgetStart){window.ventlogWidgetStart(" + JSONObject.quote(mode) + ");}");
    }

    @Override protected void onNewIntent(Intent input) {
        super.onNewIntent(input);
        setIntent(input);
        receiveShare(input);
        applySharedText();
        queueWidgetStart(input);
    }
    private void show(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (webView != null) {
            webView.removeJavascriptInterface("VentlogAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }
}
