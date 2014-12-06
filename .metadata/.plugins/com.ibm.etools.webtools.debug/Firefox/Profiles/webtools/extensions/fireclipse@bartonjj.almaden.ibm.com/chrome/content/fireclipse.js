/* See License.txt Copyright (C) 2007 */
 
FBL.ns(function() { with (FBL) {

const Cc = Components.classes;
const Ci = Components.interfaces;
const PrefService = Cc["@mozilla.org/preferences-service;1"];
const jsdIStackFrame = Ci.jsdIStackFrame;
const nsIPrefBranch2 = Ci.nsIPrefBranch2;

const observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

// ************************************************************************************************

Firebug.Fireclipse = extend(Firebug.Module,
{
	debug: false, 
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * 
    // extends Module
	
    initialize: function() 
    {
    	if (window.location.toString().indexOf("chrome://browser/content/browser.xul") == -1)
    		return;  // These are temporary hacks until I can clean up chromebug
    	 
    	try 
    	{
    	    if (FBTrace.DBG_FIRECLIPSE) 
    	        FBTrace.sysout("webtools.debug Fireclipse.Module.initalize() "+window.location+"\n");
    	    Firebug.registerExtension(this);
    	
    	    this.loadPrefs();
    	
    	    var updateURL = new String(this.eclipseURL + "UpdateNotification/");
    	    this.observerURL = new String(this.eclipseURL);
    	
    	    this.statusIcon = document.getElementById("fireclipseStatusIcon");
            this.syncIcon = document.getElementById("fireclipseSyncIcon");
            this.setStatusSync();
    	
            QuitApplicationGrantedObserver.eclipseURL = this.eclipseURL;
            observerService.addObserver(QuitApplicationGrantedObserver, "quit-application-granted", false);
            
    	    this.setStatusNotConnected("initialized");
    	
    	    this.ajaxUpdateStatus(updateURL);
    	    Fireclipse.consoleListener.setFormatter({},function(aMessage){return aMessage.toString()});
    	    Fireclipse.consoleListener.startListening(new String(this.eclipseURL));
    	}
    	catch (exc) 
    	{
    		FBTrace.dumpProperties("webtools.debug Fireclipse failed to initialize ", exc);
    	}
    },
 
    setStatusConnected: function(info)
    {
        this.setStatusText("Connected "+(info?info:""));
        this.statusIcon.setAttribute("connected", "true");
    },
    
    setStatusNotConnected: function(info)
    {
        this.setStatusText("Not Connected "+(info?info:""));
        this.statusIcon.removeAttribute("connected");
    },
    
    isConnected: function()
    {
        return (this.statusIcon.getAttribute("connected") == "true");
    },
    
    setStatusSync: function(info)
    {
        this.syncIcon.setAttribute("sync", "true");
    },
    
    setStatusNotSync: function(info)
    {
        this.syncIcon.removeAttribute("sync");
    },
    
    isSync: function()
    {
        return (this.syncIcon.getAttribute("sync") == "true");
    },
    
    setStatusText: function(text)
    {
    	if (!this.statusText) 
    		this.statusText = document.getElementById('fireclipseStatusText');
    	if (FBTrace.DBG_FIRECLIPSE) 
    	    this.statusText.setAttribute("value", text);   
    	this.statusIcon.setAttribute("tooltiptext", text);
        this.statusText.setAttribute("collapsed", false);
        if (FBTrace.DBG_FIRECLIPSE_HEARTBEAT) 
            FBTrace.sysout("setStatusText "+text+"\n");
    },
    
    showContext: function(browser, context)
    {
        if (this.matchesURLPattern(context.window.location.href))
        {
            browser.showFirebug = true;
        }
    },
    
    watchedContexts: [],
    urlPatterns: [], 
    
    loadedContext: function(context)
    {
    	if (window.location.toString().indexOf("chrome://browser/content/browser.xul") == -1)
    		return;  // These are temporary hacks until I can clean up chromebug
    	if (FBTrace.DBG_FIRECLIPSE) 
    	    FBTrace.sysout("fireclipse.loadedContext\n");
    	if (context && context.window && context.window.location)
    	{
    		var url = context.window.location.toString();
    		if (FBTrace.DBG_FIRECLIPSE) 
    		    FBTrace.sysout("fireclipse.loadedContext checking url:"+url+"\n");
    		if (this.matchesURLPattern(url))
    		{
    			this.watchedContexts.push(context);
    			this.sendSeen(url);
    			if (FBTrace.DBG_FIRECLIPSE) 
    			    FBTrace.sysout("fireclipse.loadedContext sent url:"+url+"\n");
    			this.sendScriptsSeen(context);
    		}
    	}
    },
    
    matchesURLPattern: function(url)
    {
    	for (var i = 0; i < this.urlPatterns.length; i++)
    	{
    		if (FBTrace.DBG_FIRECLIPSE) 
    		    FBTrace.sysout("fireclipse matchURLPatterns "+url+" vs "+this.urlPatterns[i]);
    		if (this.urlPatterns[i].test(url))
    		{
    		    if (FBTrace.DBG_FIRECLIPSE)
    		        FBTrace.sysout(" true\n");
    			return true;
    		}
    		if (FBTrace.DBG_FIRECLIPSE)
                FBTrace.sysout(" false\n");
    	}
    	return false;
    },
    
    destroyContext: function(context)
    {
    	if (window.location.toString().indexOf("chrome://browser/content/browser.xul") == -1)
    		return;  // These are temporary hacks until I can clean up chromebug
    	
        FBL.remove(this.watchedContexts, context);
    },
    
    //*************************************************************************************************
    loadPrefs: function()
    {
    	if (!this.prefs)
    		this.prefs = PrefService.getService(nsIPrefBranch2);
    	
    	this.eclipseURL =  this.prefs.getCharPref("extensions.webtools.debug.eclipseURL");
    	this.token =      this.prefs.getCharPref("extensions.webtools.debug.token");
    	FBTrace.DBG_FIRECLIPSE = this.prefs.getBoolPref("extensions.firebug.DBG_FIRECLIPSE");
    	FBTrace.DBG_FIRECLIPSE_OUTBOUND = this.prefs.getBoolPref("extensions.firebug.DBG_FIRECLIPSE_OUTBOUND");
    	if (FBTrace.DBG_FIRECLIPSE) 
    	    FBTrace.sysout("webtools.debug loadPrefs eclipseURL:"+this.eclipseURL+" token:"+this.token+"\n");
    },
    //*************************************************************************************************
	
	readyStatus: ['unset', 'loading', 'loaded-not-ready', 'loaded-read-only', 'complete'],
	
	asyncLoad: function(url, body) 
	{
    	if (!url.onComplete)
    		throw "webtools.debug asyncLoad needs an onComplete handler for url:"+url;
    	
		var req = new XMLHttpRequest();
		req.onreadystatechange = function asyncLoadReadyStateChange(event) 
		{
		    if (FBTrace.DBG_FIRECLIPSE_HEARTBEAT) 
		        FBTrace.sysout("asyncLoad readyState "+Firebug.Fireclipse.readyStatus[req.readyState]+" "+url+"\n");
		    if (url.onLoading && req.readyState == 1)
		        url.onLoading(req);
			if (req.readyState == 4) 
				url.onComplete(req);
		}
		
		try 
		{
			if (body)
				req.open('POST', url, true);
			else
				req.open('GET', url, true);
		      
			if (this.token)
				req.setRequestHeader("X-webtools-debug-token", this.token); 
			
			req.send(body);	
		} 
		catch (e) 
		{
			if (url.onError)
				url.onError(e);
			else 
				throw "webtools.debug asyncLoad url has no onError handler for url: "+url+" error: "+e;
		}
	},
	
	getElementById: function(id, container) 
	{   
		var elts = container.getElementsByTagName('*');
		for(i = 0; i < elts.length; i++) 
		{
			var elt = elts.item(i);
			var elt_id = elt.getAttribute('id');
			if (elt_id == id) return elt;
		}
		return null;
	},
	
	ajaxUpdateStatus: function(updateURL) 
	{
    	this.updater = new String(updateURL);  // String object, not string builtin
    	
    	var theUpdater = this.updater;
    	this.updater.onLoading = function updateStatusWaiting(request)
    	{
    	    Firebug.Fireclipse.setStatusConnected();
    	}
    	
		this.updater.onComplete = function updateStatusComplete(request) 
		{
			if (request.status == 200)
			{
				try 
				{
					if (FBTrace.DBG_FIRECLIPSE_HEARTBEAT) FBTrace.sysout("Fireclipse.ajaxUpdateStatus 200 "+theUpdater+" responseText:\""+request.responseText+"\"\n");
					var msg = eval("msg="+request.responseText);
					if (FBTrace.DBG_FIRECLIPSE_HEARTBEAT) FBTrace.dumpProperties("Fireclipse.ajaxUpdateStatus got:", msg);
					if (msg.command)
					{
						var command = theUpdater[msg.command];
						if (command)
						{
							Firebug.Fireclipse.setStatusConnected(msg.command);
							command.apply(theUpdater, [msg]);
						}
						else
							Firebug.Fireclipse.setStatusConnected("No command matches "+msg.command);
					}
					else
						Firebug.Fireclipse.setStatusConnected("No command in message");
						
					Firebug.Fireclipse.updateRequestTimeoutID = setTimeout(doUpdateRequest);  // Looping...
				}
				catch (exc)
				{
				    if (FBTrace.DBG_FIRECLIPSE) FBTrace.dumpProperties("Fireclipse.ajaxUpdateStatus FAILs", exc);
				}
			}
			else // if the server does not reply, eg a bad url we get status zero
			{
			    Firebug.Fireclipse.setStatusNotConnected(request.status+"");
				if (FBTrace.DBG_FIRECLIPSE_OUTBOUND)FBTrace.dumpProperties("Fireclipse.ajaxUpdateStatus FAILED "+theUpdater+" request:", request);
			}
			
		};
		
		this.updater.onError = function updateStatusError(e) 
		{
			Firebug.Fireclipse.setStatusNotConnected('Error: '+e);
			// TODO offer way to restart
		};
		
		// ---------------------------------------------------------------------------------------
		// Commands, must match webtools.debug commands
		
		this.updater.heartbeat = function(msg)
		{
		    if (FBTrace.DBG_FIRECLIPSE_HEARTBEAT) FBTrace.sysout("Fireclipse Updater heartbeat\n");
		    return true;
		}
		
		this.updater.watch = function(msg)
		{
		    if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater watch\n");
		    
		    var patterns = msg.patterns;
		    Firebug.Fireclipse.urlPatterns = [];
            for (var i = 0; i < patterns.length; i++)
            {
                Firebug.Fireclipse.urlPatterns.push( new RegExp(patterns[i]) );
            }
            if (FBTrace.DBG_FIRECLIPSE) FBTrace.dumpProperties("Fireclipse.updater.watch urls:", Firebug.Fireclipse.urlPatterns);
		}
		
		this.updater.tryReloading = function(msg)
		{
			var url = msg.href;
			if (!url)
				return false;
			
			var contexts = Firebug.Fireclipse.watchedContexts;
			if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater tryReloading from "+contexts.length+" contexts\n");
			for (var i = 0; i < contexts.length; i++)
			{
				var location = FirebugChrome.getBrowserURI(contexts[i]);
				if (!location)
				{
					if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater tryReloading context "+i+" has no location "+contexts[i].window.location+'\n');
					continue;
				}
				
				if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater tryReloading url "+url+" vs "+location.spec+"\n");
				if (location.spec == url)
				{
					var tabs = Firebug.tabBrowser.tabContainer.childNodes;
					if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater found context, looking among "+tabs.length+" tabs\n");
					for (var i = 0; i < tabs.length; i++)
					{
						var browser = Firebug.tabBrowser.getBrowserAtIndex(i);
						if (url == browser.currentURI.spec)
						{
							if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater found tab, reloading url "+url+"\n");							
							Firebug.tabBrowser.selectedTab = tabs[i];
							Firebug.tabBrowser.focus();
							FirebugChrome.reload(true);
							return true;
						}
					}
				}
			}
			return false;
		};
		
		this.updater.open = function(msg)
		{
			var url = msg.href;
			if (!url)
			{
			    if (FBTrace.DBG_FIRECLIPSE) FBTrace.sysout("Fireclipse Updater.open, no url\n"); 
				return false;
			}
			
			if (this.tryReloading(msg)) 
			{
			    window.focus();  
				return true;
			}
			else 
			{
				FBL.openNewTab(url);
				window.focus(); 
				return true;
			}
		};
		
		this.updater.quitApplication = function()
		{
			var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
				getService(Components.interfaces.nsIAppStartup);

		  // eAttemptQuit will try to close each XUL window, but the XUL window can cancel the quit
		  // process if there is unsaved data.  
		  var quitSeverity = Components.interfaces.nsIAppStartup.eAttemptQuit;
		  appStartup.quit(quitSeverity);
		};
		
		doUpdateRequest(); // start loop		
	},
	 
	onClickStatusIcon: function(event)
	{
	    if (!Firebug.Fireclipse.isConnected()) 
	        doUpdateRequest();  // restart loop
	},
	
	onClickSyncIcon: function(event)
	{
	    if (Firebug.Fireclipse.isSync()) 
	        Firebug.Fireclipse.setStatusNotSync();
	    else
	        Firebug.Fireclipse.setStatusSync();
	},
	// --------------------------------------------------------------------------------------------------------
	
	sendSeen: function(url)
	{
		var seenURL = new String(this.eclipseURL+"SeenURLs/");
        
		seenURL.onComplete = function seenURLsConfirm(event) 
        {
            if (FBTrace.DBG_FIRECLIPSE_OUTBOUND) FBTrace.sysout("Firebug.Fireclipse.seenURLsConfirm "+location.href+"\n");
        }
        
        seenURL.onError = function seenURLsFailed(event) 
        {
            if (FBTrace.DBG_FIRECLIPSE_OUTBOUND) FBTrace.sysout("Firebug.Fireclipse.seenURLs FAILED\n");
        }
        
        var json = this.toJSON({href: url});
        Firebug.Fireclipse.asyncLoad(seenURL, json);
        if (FBTrace.DBG_FIRECLIPSE_OUTBOUND)
           FBTrace.sysout("Firebug.Fireclipse.sendseenURLsToEclipse sent sync for ", json);
	},
	
	sendScriptsSeen: function(context)
	{
	    var sourceFileMap = context.sourceFileMap;
	    for (var url in sourceFileMap)
	        this.sendSeen(url);
	},
	
    //*************************************************************************************************
    // uiListener
	 
    onPanelNavigate: function(object, panel)  // move the panel to a new location (object)
    {
	    try 
	    {
	        if (object && FBTrace.DBG_FIRECLIPSE_OUTBOUND) FBTrace.sysout("Firebug.Fireclipse.onPanelNavigate object: "+ object+"\n");
	        this.sendSourceLocationToEclipse(object);
	    } 
	    catch(e)
	    {
	        if (FBTrace.DBG_FIRECLIPSE_OUTBOUND) 
	            FBTrace.dumpProperties("Firebug.Fireclipse.onPanelNavigate fails ",e);
	    }
    },
    
    onPanelSelect: function(object, panel) // item inside of current location selected
    {
        if (object && FBTrace.DBG_FIRECLIPSE_OUTBOUND) FBTrace.sysout("Firebug.Fireclipse.onPanelSelect location: "+panel.getObjectLocation( object )+"\n");
        this.sendSourceLocationToEclipse(object);
    },
    
    onLineSelect: function(sourceLink)
    {
         this.sendSourceLocationToEclipse(sourceLink);
    },
    
    getSourceLocationSender: function()
    {
        if (!this.sourceLocationSender) 
        {
            this.sourceLocationSender = new String(this.eclipseURL + "FireclipseSync/");
            
            this.sourceLocationSender.onComplete = function sourceLocationConfirm(request) 
            {
                var responseText = request.responseText;
                if (FBTrace.DBG_FIRECLIPSE_OUTBOUND) 
                    FBTrace.sysout("Firebug.Fireclipse.sourceLocationConfirm "+responseText+"\n");
            }
            
            this.sourceLocationSender.onError = function sourceLocationFailed(event) 
            {
                if (FBTrace.DBG_FIRECLIPSE_OUTBOUND) 
                    FBTrace.sysout("Firebug.Fireclipse.sourceLocation FAILED\n");
            }
        }
        return this.sourceLocationSender;
    },
    
    sendSourceLocationToEclipse: function(object) 
    {
        if (!this.isSync())
        { 
            if (FBTrace.DBG_FIRECLIPSE_OUTBOUND) 
                FBTrace.sysout("Fireclipse.sendSourceLocationToEclipse sync is off\n");
            return;
        }
        
        var location = this.getSourceDescription(object);
        if (location) 
        {
        	if (!this.matchesURLPattern(location.href))
        	{
        		if (FBTrace.DBG_FIRECLIPSE) 
        		    FBTrace.sysout("Fireclipse.sendSourceLocationToEclipse no matchURLPattern for "+location.href+"\n");
        		return;
        	}
        	
        	var url = this.getSourceLocationSender();

	        var json = this.toJSON(location);
	        Firebug.Fireclipse.asyncLoad(url, json);
	        if (FBTrace.DBG_FIRECLIPSE_OUTBOUND)
	           FBTrace.sysout("Firebug.Fireclipse.sendSourceLocationToEclipse sent sync for ", json);
	    }
	    else
	    {
	       if (FBTrace.DBG_FIRECLIPSE_OUTBOUND)
	           FBTrace.sysout("Firebug.Fireclipse.sendSourceLocationtoEclipse no location in ", object);
	    }
    },
    
    getSourceDescription: function(object)
    {
        if (object instanceof CSSStyleRule)
        {
            var line = domUtils.getRuleLine(rule);
            return { href: object.parentStyleSheet.href, line: (line?line:"1") };
        }
        else if (object instanceof CSSStyleSheet)
        {
            return { href: getURLForStyleSheet(object), line: "1" };
        }
        else if (object instanceof SourceLink)
        { 
            return { href: object.href, line: object.line }
        }
        else if (object instanceof jsdIStackFrame)
        {   
            if (jsdIStackFrame.isValid)            
                return { href: frame.script.fileName, line: frame.line }
        }
        else if (object instanceof SourceFile)
        {
            return { href: object.href, line: "1" }
        }
        if (FBTrace.DBG_FIRECLIPSE_OUTBOUND)
            FBTrace.dumpTypes("fireclipe getSourceDescription unhandled object: ", object);
    },
    
    toJSON: function(location)
    {
        var json = "{\n";
        for (var p in location)
        {
            if (location[p] instanceof Function) continue;
            json += "\"" + p +"\": \""+location[p]+"\",\n ";
        }
        json += "}\n";
        return json;
    },
     
 
});


function doUpdateRequest()
{
	Firebug.Fireclipse.asyncLoad(Firebug.Fireclipse.updater, Firebug.version);
}

var QuitApplicationGrantedObserver =
{
        observe: function(subject, topic, data)
        {
            if (FBTrace.DBG_FIRECLIPSE)
                FBTrace.sysout("webtools.debug QuitApplicationGrantedObserver eclipseURL:"+QuitApplicationGrantedObserver.eclipseURL+"\n");
            clearTimeout(Firebug.Fireclipse.updateRequestTimeoutID);
            Fireclipse.consoleListener.stopListening();
            var req = new XMLHttpRequest();
            var quitter = document.getElementById("fireclipseQuitter");
            quitter.removeAttribute("value");
            quitter.mode="undetermined";
            quitter.removeAttribute("collapsed");
            req.open('GET', QuitApplicationGrantedObserver.eclipseURL+"FirefoxExit/", false);
            req.send(null);
            if (FBTrace.DBG_FIRECLIPSE)
                FBTrace.sysout("webtools.debug QuitApplicationGrantedObserver eclipseURL:"+QuitApplicationGrantedObserver.eclipseURL+"\n");
        }
};

// ************************************************************************************************

FBTrace.DBG_FIRECLIPSE_OUTBOUND = false;
FBTrace.DBG_FIRECLIPSE = false;
Firebug.registerModule(Firebug.Fireclipse);

// ************************************************************************************************

}});

 
