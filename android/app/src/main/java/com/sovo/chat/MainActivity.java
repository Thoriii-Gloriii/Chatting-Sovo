package com.sovo.chat;

import android.app.DownloadManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // The WebView has no download handling of its own: an <a download>
        // or a navigation to a media URL is silently dropped unless a
        // DownloadListener is attached. Hand those off to Android's
        // DownloadManager so "Download" on a chat attachment actually writes
        // the file into the device's Downloads folder with a progress
        // notification, instead of appearing to do nothing.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                try {
                    if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
                        Toast.makeText(this, "This attachment cannot be downloaded.", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);

                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);

                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) {
                        request.addRequestHeader("Cookie", cookie);
                    }

                    request.setTitle(fileName);
                    request.setDescription("Downloading from S'ovo Chat");
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        request.setRequiresCharging(false);
                    }

                    DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (manager == null) {
                        Toast.makeText(this, "Downloads are unavailable on this device.", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    manager.enqueue(request);
                    Toast.makeText(this, "Downloading " + fileName, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    // Never let a download failure take the WebView down — surface
                    // it to the user and carry on.
                    Toast.makeText(this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
