pref("extensions.fireclipse.user_interface_url", "chrome://fireclipse/content/fireclipse.xul");
pref("extensions.fireclipse.startup-onload", true);
pref("extensions.fireclipse.open-ui-onload", true);

pref("extensions.firebug.DBG_FIRECLIPSE_OUTBOUND", false);
pref("extensions.firebug.DBG_FIRECLIPSE", false);
pref("extensions.webtools.debug.eclipseURL", "http://localhost:63636/");
pref("extensions.webtools.debug.token", "1337");


// Change the way the browser works
pref("browser.dom.window.dump.enabled", true);
pref("signed.applets.codebase_principal_support", true);
pref("browser.sessionstore.resume_from_crash", false); // don't restore when we kill the browser