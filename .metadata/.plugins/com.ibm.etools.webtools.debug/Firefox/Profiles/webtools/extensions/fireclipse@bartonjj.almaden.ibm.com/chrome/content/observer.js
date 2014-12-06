/* See License.txt Copyright (C) 2007 */


/*
 * Listen to mozilla nsIConsoleService and POST to eclipse.
 */

if(typeof Fireclipse == 'undefined')
{
	var Fireclipse = {};
}

Fireclipse.consoleListener = 
{

    setFormatter: function(formatter, fn) 
    {
	    this.messageFormatter = formatter;
	    this.format = fn;
    },

    oid: Math.round(100000*Math.random()), 

    sendEdit: function(filename) 
    {
        this.aConsoleService.logStringMessage("[Fireclipse Request: \"Please edit\" {file: \""+filename+"\" line:1}]");
    },


    startListening: function (url, uid)
    { 
        if (!this.listeningToConsole) 
        {
            this.eclipse_url = url + 'ErrorConsole/';
            this.uid = uid;


            this.restartListening();
        }
    },

    /*-- <a href="http://www.mozilla.org/projects/xpcom/using-consoleservice.html"> --*/
    restartListening: function() 
    {
        this.aConsoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                                  .getService(Components.interfaces.nsIConsoleService);
        this.aConsoleService.registerListener(Fireclipse.consoleListener);
        this.listeningToConsole = true;
        this.setStatus("Fireclipse listening for console messages"); 
    },
    /*-- </a> --*/

    stopListening: function() 
    {
        this.setStatus("Fireclipse stopListening");
        this.listeners = null;
        if (this.listeningToConsole) 
        {
            this.aConsoleService.unregisterListener(this);
            this.listeningToConsole = false;
        }
        this.setStatus("Fireclipse NOT listening for console, saw "+this.total_messages);
    },

    addStatusChangeEventListener: function(listener) 
    {
        if (!this.listeners) this.listeners = new Array();
        this.listeners.push(listener);
    },

    setStatus: function(msg) 
    {
        if (!this.listeners) return;
        try 
        {
            for(i = 0; i < this.listeners.length; i++) 
            {
                var listener = this.listeners[i];
                listener(this, msg);
            }
        } 
        catch (error) 
        {
            try 
            {
                this.observerInfo("Fireclipse setStatus fails to set message=\'"+msg+"\' because of "+error+"\n");
            } 
            catch (error) 
            {
                // Sometimes this.observerInfo fails, sends console messages and we end up in a loop
                if (this.listeningToConsole) this.stopListening();
            }
        }
    },

    total_messages: 0,
    readyStatus: ['unset', 'loading', 'loaded-not-ready', 'loaded-read-only', 'complete'],
    ajax_failed_regexp: /\(NS_ERROR_NOT_AVAILABLE\) \[nsIXMLHttpRequest\.status\]/,

    observer_debug: false,
    observerInfo: function(msg) 
    {
        if (!Fireclipse.consoleListener.observer_debug) 
            return;
        try 
        {
            dump(msg);
        } 
        catch(e) 
        {
            // no-op
        }
    },

    mapMessage: function(message) {
        if (this.ajax_failed_regexp.test(message)) {
            this.setStatus("Dropped nsIXMLHttpRequest error message="+message);
            if (this.observer_debug) this.observerInfo("dropped "+message+" "+this.total_messages+"\n");
            return false;
        }	
        var msg = this.format.apply(this.messageFormatter, [message])
        return  msg;
    },

    /* WARNING: errors in this method cause infinite loops in firefox */
    observe: function( aMessage )
    {
        try 
        {
            if (!this.messageFormatter) 
            {
                this.setStatus("Console listener fails: messageFormatter is NOT set"); 		
                return;
            }

            this.total_messages++;
            if (this.observer_debug) 
                this.observerInfo("Fireclipse.observe entering "+this.total_messages+" ... ");

            try 
            {
                var message = this.mapMessage(aMessage.message);
                if ( !message ) 
                {
                    if (this.observer_debug) this.observerInfo("...Fireclipse.observe dropped "+this.total_messages+"\n");
                    return false;
                }
                send(message);
            } 
            catch(failed) 
            {
                this.setStatus(failed);
                if (this.observer_debug) this.observerInfo("...Fireclipse.observe failed "+this.total_messages+": "+failed+" =-= original message was =-="+aMessage.message+"\n");
                return false;
            }

            if (this.observer_debug) 
                this.observerInfo("exiting "+this.total_messages+"\n");
        } 
        catch (exc) 
        {
            Fireclipse.consoleListener.stopListening();
        }

    },

    QueryInterface: function (iid) {
        if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
                !iid.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return Fireclipse.consoleListener;
    }
};



function send(message)  // TODO rewrite this from scratch!
{
    var listener = Fireclipse.consoleListener;
    var http_request = new XMLHttpRequest();
    if (!http_request) 
    {
        listener.stopListening();  // avoid loops
        listener.observerInfo('Fireclipse cannot create an XMLHTTP instance\n');
        fireclipse_menu_item.setAttribute("checked", false);
        return false;
    }

    http_request.message_number = listener.total_messages;
    
    http_request.onreadystatechange = function handleOnReadyStateChange() 
    {
        if (http_request.readyState == 4) 
        {
            var self = Fireclipse.consoleListener;
            var status; 
            try 
            {
                status = http_request.status;
            } 
            catch (error) 
            {
                // if the http_request is not to http the status may not be defined
                status = "";
                for (p in http_request) 
                {
                    status += p +'='+http_request[p];
                }
                listener.setStatus("Fireclipse error: http_request status not defined; defined was: "+status);
            }
            if (status == 200) 
                listener.setStatus(listener.readyStatus[http_request.readyState]+" "+listener.total_messages);
            else 
            {
                listener.stopListening();  // avoid loops
                listener.observerInfo(http_request.status+': Fireclipse Errors: '+http_request.responseText+"\n");
            }
        } 
        else 
        {	
            try 
            {
                listener.setStatus(listener.readyStatus[http_request.readyState]+"("+http_request.message_number+")");
            } 
            catch (error) 
            {
                listener.stopListening();  // avoid loops
                listener.observerInfo('Fireclipse Errors: '+error+" readyState="+http_request.readyState+"\n");
            }
        }
    }
    http_request.open('POST', listener.eclipse_url, true);
    http_request.send(message);
}