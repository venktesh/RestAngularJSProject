const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const PrefService = Cc["@mozilla.org/preferences-service;1"];
const nsIPrefBranch2 = Ci.nsIPrefBranch2;
const nsIPrefService = Ci.nsIPrefService;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function CommandLineHandler() {
}
var hiddenWindow = null;
CommandLineHandler.prototype = {
		
	handle: function(cmdLine)
	{
    	try
        {
           var appShellService = Components.classes["@mozilla.org/appshell/appShellService;1"].
                getService(Components.interfaces.nsIAppShellService);

            /*
            hiddenWindow = appShellService.hiddenDOMWindow;
            hiddenWindow.dump("webtools.debug Extension CommandLine\n");
            hiddenWindow.dump("Chromebug Command Line Handler taking arguments from state:"+cmdLine.state+"\n");
            for (var i = 0; i < cmdLine.length; i++)
                hiddenWindow.dump("Chromebug Command Line Handler arguments on cmdLine: "+cmdLine.length+"."+i+")"+cmdLine.getArgument(i)+"\n");
            */
            
            var eclipseURL = cmdLine.handleFlagWithParam("eclipseURL", false);
            if (eclipseURL)
            {
                var prefs = PrefService.getService(nsIPrefBranch2);
                prefs.setCharPref("extensions.webtools.debug.eclipseURL", eclipseURL);
                
                var prefService = PrefService.getService(nsIPrefService);
                prefService.savePrefFile(null); 
                //hiddenWindow.dump("set eclipseURL "+eclipseURL+"\n");
            }
            
        }
        catch (e)
        {
            Components.utils.reportError("webtools.debug Command Line Handler FAILS: "+e);
            return;
        }
	},

  	helpInfo: "",

  	classDescription: "webtools.debug firefox extension command line",
  	contractID: "@mozilla.org/mccoy/webtools-debug-clh;1",
  	classID: Components.ID("{c06ec3c3-6b73-4fe1-a42f-db6076bda518}"),
  	QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
  	_xpcom_categories: [{ category: "command-line-handler", entry: "m-webtools-debug-clh" }]
};

function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule([CommandLineHandler]);
}
/* See license.txt for terms of usage */
/* John J. Barton johnjbarton@johnjbarton.com March 2007 */