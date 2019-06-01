/* globals SIP,user,moment, Stopwatch */
var ENABLE_LOG = true;
var ctxSip;

var wss_port = '8089';
var wss_domain = 'simplessolution.com';
var user_agent = 'Simples Webphone';
var wss_url     = 'wss://' + getCookie('wss_subdomainclient') + '.' + wss_domain + ':' + wss_port + '/ws';
var phoneLogin = getCookie('phoneLogin');
var adwp       = getCookie('adwp');
var isHold     = false;
var isMuted    = false;
var rec        = false;
var code       = '';
// console.log(wss_url);
function extractDomain(url) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    } else {
        domain = url.split('/')[0];
    }

    //find & remove port number
    domain = domain.split(':')[0];

    return domain;
}

function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }





$(document).ready(function() {




    if (typeof(user) === 'undefined') {
        // user = JSON.parse(localStorage.getItem('SIPCreds'));
        // $("#phonePanel").hide();
    }

    

    ctxSip = {

        config : {
                password: atob(adwp),
                authorizationUser: phoneLogin,
                displayName: phoneLogin,
                userAgentString: user_agent,
                uri: phoneLogin + '@' + extractDomain(wss_url),
                transportOptions: {
                    wsServers: [wss_url],
                    traceSip: false,
                    maxReconnectionAttempts: 30,
                    reconnectionTimeout: 5
                },
                hackWssInTransport: true,
                registerExpires: 30,
                hackIpInContact: true,
                log: {
                    level: 1
                },
                sessionDescriptionHandlerFactoryOptions: {
                    constraints: {
                        audio: true,
                        video: false
                },
                media: { 
                    constraints: 
                    { 
                        audio: true, video: false }, 
                        render: { remote: document.getElementById("audio") } 
                    },
        // peerConnectionOptions: {
        //     rtcConfiguration: {"rtcpMuxPolicy":"negotiate"},
        //     iceCheckingTimeout: 500
         },
    },
        ringtone     : document.getElementById('ringtone'),
        ringbacktone : document.getElementById('ringbacktone'),
        dtmfTone     : document.getElementById('dtmfTone'),

        Sessions     : [],
        callTimers   : {},
        callActiveID : null,
        callVolume   : 1,
        Stream       : null,

        /**
         * Parses a SIP uri and returns a formatted US phone number.
         *
         * @param  {string} phone number or uri to format
         * @return {string}       formatted number
         */
        formatPhone : function(phone) {
            // console.log(config);
            var num;

            if (phone.indexOf('@')) {
                num =  phone.split('@')[0];
            } else {
                num = phone;
            }

            num = num.toString().replace(/[^0-9]/g, '');

            if (num.length === 10) {
                return '(' + num.substr(0, 3) + ') ' + num.substr(3, 3) + '-' + num.substr(6,4);
            } else if (num.length === 11) {
                return '(' + num.substr(1, 3) + ') ' + num.substr(4, 3) + '-' + num.substr(7,4);
            } else {
                return num;
            }
        },

        // Sound methods
        startRingTone : function() {
            try { ctxSip.ringtone.play(); } catch (e) { }
        },

        stopRingTone : function() {
            try { ctxSip.ringtone.pause(); } catch (e) { }
        },

        startRingbackTone : function() {
            try { ctxSip.ringbacktone.play(); } catch (e) { }
        },

        stopRingbackTone : function() {
            try { ctxSip.ringbacktone.pause(); } catch (e) { }
        },

        // Genereates a rendom string to ID a call
        getUniqueID : function() {
            return Math.random().toString(36).substr(2, 9);
        },

        newSession : function(newSess) {

            newSess.displayName = newSess.remoteIdentity.displayName || newSess.remoteIdentity.uri.user;
            newSess.ctxid       = ctxSip.getUniqueID();

            var status;
            // console.log(status);
            if (newSess.direction === 'incoming') {
                status = "Incoming: "+ newSess.displayName;
                ctxSip.startRingTone();
            } else {
                status = "Trying: "+ newSess.displayName;
                ctxSip.startRingbackTone();
            }

            ctxSip.logCall(newSess, 'ringing');
            
            ctxSip.setCallSessionStatus(status);


            // EVENT CALLBACKS

            newSess.on('progress',function(e) {
                if (e.direction === 'outgoing') {
                    ctxSip.setCallSessionStatus('Calling...');
                    $('.btnCall').addClass('hide');
                }
            });

            newSess.on('connecting',function(e) {
                if (e.direction === 'outgoing') {
                    ctxSip.setCallSessionStatus('Connecting...');
                    $('.btnCall').addClass('hide');
                }
            });

             // newSess.on('invite', (session) => session.accept());

            newSess.on('accepted',function(e) {
                if(ENABLE_LOG) console.log('EVENT - Accepted');
                if(ENABLE_LOG) console.log(e);
                // If there is another active call, hold it
                if (ctxSip.callActiveID && ctxSip.callActiveID !== newSess.ctxid) {
                    ctxSip.phoneHoldButtonPressed(ctxSip.callActiveID);
                }
                ctxSip.attachMediaToSession(newSess);
                ctxSip.stopRingbackTone();
                ctxSip.stopRingTone();
                ctxSip.setCallSessionStatus('Answered');
                ctxSip.logCall(newSess, 'answered');
                ctxSip.callActiveID = newSess.ctxid;
                $('.btnCall').addClass('hide');
                $('.btnRec').removeClass('hide');
            });

            newSess.on('hold', function(e) {
                ctxSip.callActiveID = null;
                ctxSip.logCall(newSess, 'holding');
                isHold = true;
                activeCall = false;
                
            });

            newSess.on('unhold', function(e) {
                ctxSip.logCall(newSess, 'resumed');
                ctxSip.callActiveID = newSess.ctxid;
                isHold = false;
                activeCall = true;
            });

            newSess.on('muted', function(e) {
                ctxSip.Sessions[newSess.ctxid].isMuted = true;
                ctxSip.setCallSessionStatus("Muted");
            });

            newSess.on('unmuted', function(e) {
                ctxSip.Sessions[newSess.ctxid].isMuted = false;
                ctxSip.setCallSessionStatus("Answered");
            });

            newSess.on('cancel', function(e) {
                ctxSip.stopRingTone();
                ctxSip.stopRingbackTone();
                ctxSip.setCallSessionStatus("Canceled");
                if (this.direction === 'outgoing') {
                    ctxSip.callActiveID = null;
                    newSess             = null;
                    ctxSip.logCall(this, 'ended');
                }
                $('.btnRec').removeClass('hide');
            });

            newSess.on('bye', function(e) {
                ctxSip.stopRingTone();
                ctxSip.stopRingbackTone();
                ctxSip.setCallSessionStatus("");
                ctxSip.logCall(newSess, 'ended');
                ctxSip.callActiveID = null;
                newSess             = null;
                $('#btnRec').removeClass('hide');
            });

            newSess.on('failed',function(e) {
                ctxSip.stopRingTone();
                ctxSip.stopRingbackTone();
                ctxSip.setCallSessionStatus('Terminated');
                $('#btnRec').removeClass('hide');
            });

            newSess.on('rejected',function(e) {
                ctxSip.stopRingTone();
                ctxSip.stopRingbackTone();
                ctxSip.setCallSessionStatus('Rejected');
                ctxSip.callActiveID = null;
                ctxSip.logCall(this, 'ended');
                newSess             = null;
                $('#btnRec').removeClass('hide');
            });

            ctxSip.Sessions[newSess.ctxid] = newSess;

        },

        attachMediaToSession(session) {
            // console.log(session);
            var pc = session.sessionDescriptionHandler.peerConnection;

            if (pc.getReceivers) {
                Stream = new window.MediaStream();
                pc.getReceivers().forEach(function (receiver) {
                    var track = receiver.track;
                    if (track) {
                        Stream.addTrack(track);
                    }
                });
            } else {
                Stream = pc.getRemoteStreams()[0];
            }

            var domElement = document.getElementById('voice');
            domElement.srcObject = Stream;
            domElement.play();
        },

        toggleMute(session,mute) {

            var pc = session.sessionDescriptionHandler.peerConnection;

            if (pc.getSenders) {
                pc.getSenders().forEach(function(sender) {
                    if (sender.track) {
                        sender.track.enabled = !mute;
                        
                        
                    }
                });
            } else {
                pc.getLocalStreams().forEach(function(stream) {
                    stream.getAudioTracks().forEach(function(track) {
                        
                        track.enabled = !mute;
                    });
                    stream.getVideoTracks().forEach(function(track) {
                        track.enabled = !mute;
                    });
                });
            }
        },



        // getUser media request refused or device was not present
        getUserMediaFailure : function(e) {
            window.console.error('getUserMedia failed:', e);
            ctxSip.setError(true, 'Media Error.', 'You must allow access to your microphone.  Check the address bar.', true);
        },

        getUserMediaSuccess : function(stream) {
             ctxSip.Stream = stream;
        },

        /**
         * sets the ui call status field
         *
         * @param {string} status
         */
        setCallSessionStatus : function(status) {
            $('#txtCallStatus').html(status);
        },

        /**
         * sets the ui connection status field
         *
         * @param {string} status
         */
        setStatus : function(status) {
            $("#txtRegStatus").html('<i class="fa fa-signal"></i> '+status);
        },

        /**
         * logs a call to localstorage
         *
         * @param  {object} session
         * @param  {string} status Enum 'ringing', 'answered', 'ended', 'holding', 'resumed'
         */
        logCall : function(session, status) {

            var log = {
                    clid : session.displayName,
                    uri  : session.remoteIdentity.uri.toString(),
                    id   : session.ctxid,
                    time : new Date().getTime()
                },
                calllog = JSON.parse(localStorage.getItem('sipCalls'));

            if (!calllog) { calllog = {}; }

            if (!calllog.hasOwnProperty(session.ctxid)) {
                calllog[log.id] = {
                    id    : log.id,
                    clid  : log.clid,
                    uri   : log.uri,
                    start : log.time,
                    flow  : session.direction
                };
            }

            if (status === 'ended') {
                calllog[log.id].stop = log.time;
            }

            if (status === 'ended' && calllog[log.id].status === 'ringing') {
                calllog[log.id].status = 'missed';
            } else {
                calllog[log.id].status = status;
            }

            localStorage.setItem('sipCalls', JSON.stringify(calllog));
            ctxSip.logShow();
        },

        /**
         * adds a ui item to the call log
         *
         * @param  {object} item log item
         */
        logItem : function(item) {

            var callActive = (item.status !== 'ended' && item.status !== 'missed'),
                callLength = (item.status !== 'ended')? '<span id="'+item.id+'"></span>': moment.duration(item.stop - item.start).humanize(),
                callClass  = '',
                callIcon,
                i,
                j;
            
            switch (item.status) {
                case 'ringing'  :
                    callClass = 'list-group-item-success';
                    callIcon  = 'fa-bell';
                    break;

                case 'missed'   :
                    callClass = 'list-group-item-danger';
                    if (item.flow === "incoming") { callIcon = 'fa-chevron-left'; }
                    if (item.flow === "outgoing") { callIcon = 'fa-chevron-right'; }
                    break;

                case 'holding'  :
                    callClass = 'list-group-item-warning';
                    callIcon  = 'fa-pause';
                    break;

                case 'answered' :
                case 'resumed'  :
                    callClass = 'list-group-item-info';
                    callIcon  = 'fa-phone-square';
                    break;

                case 'ended'  :
                    if (item.flow === "incoming") { callIcon = 'fa-chevron-left'; }
                    if (item.flow === "outgoing") { callIcon = 'fa-chevron-right'; }
                    break;
            }


            // i  = '<div class="list-group-item sip-logitem clearfix  title="Double Click to Call">';
            // i += '<div class="clearfix"><div class="pull-left">';
            // i += '<i class="fa fa-fw '+callIcon+' fa-fw"></i> <strong>'+ctxSip.formatPhone(item.uri)+'</strong><br><small>'+moment(item.start).format('MM/DD hh:mm:ss a')+'</small>';
            // i += '</div>';
            // i += '<div class="pull-right text-right"><em>'+item.clid+'</em><br>' + callLength+'</div></div>';
            // i += '</div>';
            

            // if (callActive) {

            //     j += '<div class="btn-group controls  sip_control" data-uri="'+item.uri+'" data-sessionid="'+item.id+'">';
            //     if (item.status === 'ringing' && item.flow === 'incoming') {
            //         j += '<button class="btn btn-success btnCall" title="Call"><i class="fa fa-phone"></i></button>';
            //     } else {
            //         j += '<button class="btn btn-primary btnHoldResume" title="Hold"><i class="fa fa-pause"></i></button>';
            //         j += '<button class="btn btn-info btnTransfer" title="Transfer"><i class="fa fa-random"></i></button>';
            //         j += '<button class="btn btn-warning btnMute" title="Mute"><i class="fa fa-fw fa-microphone"></i></button>';
            //         // j += '<button id="record" class="btn btn-success ">Start Record</button>';
            //         // j += '<button id="stopRecord" disabled class="btn btn-danger" >Stop Record</button>';
            //     }
            //     j += '<button class="btn  btn-danger btnHangUp" title="Hangup"><i class="fa fa-stop"></i></button>';
            //     j += '</div>';
               
            //     // $('.btnCall').addClass('hide');
            // }

            // console.log(i +' ----- '+j);
                
// <div class="sip-logitem NaNsip:195@ip-172-31-26-159.us-west-2.compute.internal" data-sessionid="9v7i3ge65">



                
//////////////////////////////////////////////////////////////////////////////////////
            i  = '<div class="list-group-item sip-logitem clearfix '+callClass+'" data-uri="'+item.uri+'" data-sessionid="'+item.id+'" title="Double Click to Call">';
            i += '<div class="clearfix"><div class="pull-left">';
            i += '<i class="fa fa-fw '+callIcon+' fa-fw"></i> <strong>'+ctxSip.formatPhone(item.uri)+'</strong><br><small>'+moment(item.start).format('MM/DD hh:mm:ss a')+'</small>';
            i += '</div>';
            i += '<div class="pull-right text-right"><em>'+item.clid+'</em><br>' + callLength+'</div></div>';

            if (callActive) {
                i += '<div class="btn-group btn-group-xs pull-right">';
                if (item.status === 'ringing' && item.flow === 'incoming') {
                    i += '<button class="btn btn-md btn-success btnCall" title="Call"><i class="fa fa-phone"></i>Call</button>';
                } else {
                    i += '<button class="btn btn-xs btn-primary btnHoldResume" title="Hold"><i class="fa fa-pause"></i>Hold</button>';
                    i += '<button class="btn btn-xs btn-info btnTransfer" title="Transfer"><i class="fa fa-random"></i>Tranfer</button>';
                    i += '<button class="btn btn-xs btn-default btnSalesTransfer" title="Transfer to Sales room"><i class="fa fa-random"></i>SalesTranf</button>';
                    i += '<button class="btn btn-xs btn-warning btnMute" title="Mute"><i class="fa fa-fw fa-microphone"></i>Mute</button>';
                    i += '<button class="btn btn-xs btn-danger  btnRec " title="Call" ><i class="fa fa-microphone"></i> Rec</button>';
                }
                i += '<button class="btn btn-xs btn-danger btnHangUp" title="Hangup"><i class="fa fa-stop"></i>Hangup</button>';
                i += '</div>';
            }
            i += '</div>';

           


            $('#sip-logitems').append(i);



            // Start call timer on answer
            if (item.status === 'answered') {
                var tEle = document.getElementById(item.id);
                ctxSip.callTimers[item.id] = new Stopwatch(tEle);
                ctxSip.callTimers[item.id].start();
                $('#btnRec').addClass('hide');
            }

            if (callActive && item.status !== 'ringing') {
                ctxSip.callTimers[item.id].start({startTime : item.start});
            }

            $('#sip-logitems').scrollTop(0);
            $('#control').scrollTop(0);
        },

        /**
         * updates the call log ui
         */
        logShow : function() {

            var calllog = JSON.parse(localStorage.getItem('sipCalls')),
                x       = [];

            if (calllog !== null) {

                $('#sip-splash').addClass('hide');
                $('#sip-log').removeClass('hide');

                // empty existing logs
                $('#sip-logitems').empty();
                $('#control').empty();

                // JS doesn't guarantee property order so
                // create an array with the start time as
                // the key and sort by that.

                // Add start time to array
                $.each(calllog, function(k,v) {
                    x.push(v);
                });

                // sort descending
                x.sort(function(a, b) {
                    return b.start - a.start;
                });

                $.each(x, function(k, v) {
                    ctxSip.logItem(v);
                });

            } else {
                $('#sip-splash').removeClass('hide');
                $('#sip-log').addClass('hide');
            }
        },

        /**
         * removes log items from localstorage and updates the UI
         */
        logClear : function() {

            localStorage.removeItem('sipCalls');
            ctxSip.logShow();
        },

        sipCall : function(target) {
            if(!target){
                return;
            }
            try {
                
                var s = ctxSip.phone.invite(target, {
                    media : {
                        stream      : ctxSip.Stream,
                        constraints : { audio : true, video : false },
                        render      : {
                            remote : $('#voice').get()[0]
                        },
                        RTCConstraints : { "optional": [{ 'DtlsSrtpKeyAgreement': 'true'} ]}
                    }
                });
                s.direction = 'outgoing';
                ctxSip.newSession(s);

            } catch(e) {
                // console.log(e);
                throw(e);
            }
        },

        sipTransfer : function(sessionid) {

            var s      = ctxSip.Sessions[sessionid];
            target = window.prompt('Enter destination number', '');
            if (target != null) {
                ctxSip.setCallSessionStatus('<i>Transfering...</i>');
                // s.refer(target);
                var code = '#';
                
                s.dtmf(code);
                s.refer(target);
                console.log(code + ' tarjet: '+target);
            }
        },

        sipRecToggle : function(sessionid) {
            var code = '*1';
            var s   = ctxSip.Sessions[sessionid];
            var target = phoneLogin;
            if (target != null) {
                if(rec === false){
                    s.dtmf(code);                   
                    ctxSip.setCallSessionStatus('<i>Start Recording</i>');
                    rec = !rec;
                    $('.btnRec').removeClass('btn-xs');
                    $('.btnRec').addClass('btn-lg');
                    
                }else{
                    s.dtmf(code);
                    ctxSip.setCallSessionStatus('<i>Stop Record</i>');
                    rec = !rec;
                    $('.btnRec').removeClass('btn-lg'); 
                    $('.btnRec').addClass('btn-xs');
                }
                console.log('recStatus: ' + rec + ' dtmf: ' + code);
            }
        },

        sipSalesTransfer : function(sessionid) {

            var s      = ctxSip.Sessions[sessionid];
            target = phoneLogin;
            if (target != null) {
                ctxSip.setCallSessionStatus('<i>Transfer to sales room...</i>');
                var code = '33';
                // s.dtmf(code);
                console.log('tarjet: ' + code + target );
                s.refer(code + target);
                
            }
        },


        sipHangUp : function(sessionid) {

            var s = ctxSip.Sessions[sessionid];
            // s.terminate();
            if (!s) {
                return;
            } else if (s.startTime) {
                s.bye();
                s.terminate();
            } else if (s.reject) {
                s.reject();
                s.terminate();
            } else if (s.cancel) {
                s.cancel();
                s.terminate();
            }
            $('.btnCall').removeClass('hide');
            $('.btnRec').addClass('hide');
        },

        sipSendDTMF : function(digit) {

            try { ctxSip.dtmfTone.play(); } catch(e) { }

            var a = ctxSip.callActiveID;
            if (a) {
                var s = ctxSip.Sessions[a];
                s.dtmf(digit);
            }
        },

        phoneCallButtonPressed : function(sessionid) {

            var s      = ctxSip.Sessions[sessionid],
                target = $("#numDisplay").val();

            if (!s) {

                $("#numDisplay").val("");
                ctxSip.sipCall(target);

            } else if (s.accept && !s.startTime) {

                s.accept({
                    media : {
                        stream      : ctxSip.Stream,
                        constraints : { audio : true, video : false },
                        render      : {
                            remote : { audio: $('#audioRemote').get()[0] }
                        },
                        RTCConstraints : { "optional": [{ 'DtlsSrtpKeyAgreement': 'true'} ]}
                    }
                });
                // $('#btnCall').addClass('hide');
                $('#btnRec').removeClass('hide');

                // s.play();
                // ctxSip.newSession(s);
            }
        },

        phoneMuteButtonPressed : function (sessionid) {

            var s = ctxSip.Sessions[sessionid];
              // console.log(s);
            if (!s.isMuted) {
                s.isMuted=true;
                ctxSip.toggleMute(s,true);
                ctxSip.setCallSessionStatus("Muted");

                // s.mute();
            } else {
                ctxSip.toggleMute(s,false);
                ctxSip.setCallSessionStatus("Answered");
                $('.btnRec').removeClass('hi    de');
                 s.isMuted=false;
                // s.unmute();
            }
        },

        phoneHoldButtonPressed : function(sessionid) {

            var s = ctxSip.Sessions[sessionid];
            // if (callActiveID) {
                if (!isHold) {
                  s.unhold();
                    isHold=true;
                    ctxSip.setCallSessionStatus("Answered");
                } else {
                    s.hold();
                    isHold=false;
                    ctxSip.setCallSessionStatus("Hold");
                }
            // }
        },


        setError : function(err, title, msg, closable) {

            // Show modal if err = true
             console.log("error:" + err);
            if (err === true) {
                $("#mdlError p").html(msg);
                $("#mdlError").modal('show');

                if (closable) {
                    var b = '<button type="button" class="close" data-dismiss="modal">&times;</button>';
                    $("#mdlError .modal-header").find('button').remove();
                    $("#mdlError .modal-header").prepend(b);
                    $("#mdlError .modal-title").html(title);
                    $("#mdlError").modal({ keyboard : true });
                } else {
                    $("#mdlError .modal-header").find('button').remove();
                    $("#mdlError .modal-title").html(title);
                    $("#mdlError").modal({ keyboard : false });
                }
                $('#numDisplay').prop('disabled', 'disabled');
            } else {
                $('#numDisplay').removeProp('disabled');
                $("#mdlError").modal('hide');
            }
        },

        /**
         * Tests for a capable browser, return bool, and shows an
         * error modal on fail.
         */
        hasWebRTC : function() {

            if (navigator.webkitGetUserMedia) {
                return true;
            } else if (navigator.mozGetUserMedia) {
                return true;
            } else if (navigator.getUserMedia) {
                return true;
            } else {
                ctxSip.setError(true, 'Unsupported Browser.', 'Your browser does not support the features required for this phone.');
                window.console.error("WebRTC support not found");
                return false;
            }
        }
    }





   // Throw an error if the browser can't hack it.
    if (!ctxSip.hasWebRTC()) {
        return true;
    }

    ctxSip.phone = new SIP.UA(ctxSip.config);

    ctxSip.phone.on('connected', function(e) {
        ctxSip.setStatus("Connected");
    });

    ctxSip.phone.on('disconnected', function(e) {
        ctxSip.setStatus("Disconnected");

        // disable phone
        ctxSip.setError(true, 'Websocket Disconnected.', 'An Error occurred connecting to the websocket.');

        // remove existing sessions
        $("#sessions > .session").each(function(i, session) {
            ctxSip.removeSession(session, 1500);
        });
    });

    ctxSip.phone.on('registered', function(e) {

        var closeEditorWarning = function() {
            return 'If you close this window, you will not be able to make or receive calls from your browser.';
        };

        var closePhone = function() {
            // stop the phone on unload
            localStorage.removeItem('ctxPhone');
            ctxSip.phone.stop();
        };

        window.onbeforeunload = closeEditorWarning;
        window.onunload       = closePhone;

        // This key is set to prevent multiple windows.
        localStorage.setItem('ctxPhone', 'true');

        $("#mldError").modal('hide');
        ctxSip.setStatus("Ready: " + phoneLogin);

        // Get the userMedia and cache the stream
        // if (SIP.WebRTC.isSupported()) {
        //     SIP.WebRTC.getUserMedia({ audio : true, video : false }, ctxSip.getUserMediaSuccess, ctxSip.getUserMediaFailure);
        // }
    });

    ctxSip.phone.on('registrationFailed', function(e) {
        ctxSip.setError(true, 'Registration Error.', 'An Error occurred registering your phone.');
        ctxSip.setStatus("Error: Registration Failed");
    });

    ctxSip.phone.on('unregistered', function(e) {
        ctxSip.setError(true, 'Registration Error.', 'An Error occurred registering your phone. ');
        ctxSip.setStatus("Error: Registration Failed");
    });

    ctxSip.phone.on('invite', function (incomingSession) {

        var s = incomingSession;
// console.log('sesssion: '+ s );
        s.direction = 'incoming';
        ctxSip.newSession(s);
    });

    // Auto-focus number input on backspace.
    $('#sipClient').keydown(function(event) {
        if (event.which === 8) {
            $('#numDisplay').focus();
        }
    });

    $('#numDisplay').keypress(function(e) {
        // Enter pressed? so Dial.
        if (e.which === 13) {
            ctxSip.phoneCallButtonPressed();
        }
    });

    $('#sipClient').keydown(function(e) {
        // Esc pressed? so hangup.
        if (e.which === 27) {
            // ctxSip.phoneCallButtonPressed();
            var sessionid = $(this).closest('.sip-logitem').data('sessionid');
            ctxSip.sipHangUp(sessionid); 
            console.log(sessionid);   
        }
    });

    $('.digit').click(function(event) {
        event.preventDefault();
        var num = $('#numDisplay').val(),
            dig = $(this).data('digit');

        $('#numDisplay').val(num+dig);
        $('#numDisplay').focus();

        ctxSip.sipSendDTMF(dig);
        return false;
    });

    $('#phoneUI .dropdown-menu').click(function(e) {
        e.preventDefault();
    });

    $('#phoneUI').delegate('.btnCall', 'click', function(event) {
        ctxSip.phoneCallButtonPressed();
        // to close the dropdown
        return true;
    });

    $('.sipLogClear').click(function(event) {
        event.preventDefault();
        ctxSip.logClear();
    });

    $('#sip-logitems').delegate('.sip-logitem .btnCall', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.phoneCallButtonPressed(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem .btnHoldResume', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.phoneHoldButtonPressed(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem .btnHangUp', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.sipHangUp(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem .btnTransfer', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.sipTransfer(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem .btnSalesTransfer', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.sipSalesTransfer(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem .btnRec', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.sipRecToggle(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem .btnMute', 'click', function(event) {
        var sessionid = $(this).closest('.sip-logitem').data('sessionid');
        ctxSip.phoneMuteButtonPressed(sessionid);
        return false;
    });

    $('#sip-logitems').delegate('.sip-logitem', 'dblclick', function(event) {
        event.preventDefault();

        var uri = $(this).data('uri');
        $('#numDisplay').val(uri);
        ctxSip.phoneCallButtonPressed();
    });

    $('#sldVolume').on('change', function() {

        var v      = $(this).val() / 100,
            // player = $('audio').get()[0],
            btn    = $('#btnVol'),
            icon   = $('#btnVol').find('i'),
            active = ctxSip.callActiveID;

        // Set the object and media stream volumes
        if (ctxSip.Sessions[active]) {
            ctxSip.Sessions[active].player.volume = v;
            ctxSip.callVolume                     = v;
        }

        // Set the others
        $('audio').each(function() {
            $(this).get()[0].volume = v;
        });

        if (v < 0.1) {
            btn.removeClass(function (index, css) {
                   return (css.match (/(^|\s)btn\S+/g) || []).join(' ');
                })
                .addClass('btn btn-sm btn-danger');
            icon.removeClass().addClass('fa fa-fw fa-volume-off');
        } else if (v < 0.8) {
            btn.removeClass(function (index, css) {
                   return (css.match (/(^|\s)btn\S+/g) || []).join(' ');
               }).addClass('btn btn-sm btn-info');
            icon.removeClass().addClass('fa fa-fw fa-volume-down');
        } else {
            btn.removeClass(function (index, css) {
                   return (css.match (/(^|\s)btn\S+/g) || []).join(' ');
               }).addClass('btn btn-sm btn-primary');
            icon.removeClass().addClass('fa fa-fw fa-volume-up');
        }
        return false;
    });

    // Hide the spalsh after 3 secs.
    setTimeout(function() {
        ctxSip.logShow();
    }, 2000);


    /**
     * Stopwatch object used for call timers
     *
     * @param {dom element} elem
     * @param {[object]} options
     */
    var Stopwatch = function(elem, options) {

        // private functions
        function createTimer() {
            return document.createElement("span");
        }

        var timer = createTimer(),
            offset,
            clock,
            interval;

        // default options
        options           = options || {};
        options.delay     = options.delay || 1000;
        options.startTime = options.startTime || Date.now();

        // append elements
        elem.appendChild(timer);

        function start() {
            if (!interval) {
                offset   = options.startTime;
                interval = setInterval(update, options.delay);
            }
        }

        function stop() {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        }

        function reset() {
            clock = 0;
            render();
        }

        function update() {
            clock += delta();
            render();
        }

        function render() {
            timer.innerHTML = moment(clock).format('mm:ss');
        }

        function delta() {
            var now = Date.now(),
                d   = now - offset;

            offset = now;
            return d;
        }

        // initialize
        reset();

        // public API
        this.start = start; //function() { start; }
        this.stop  = stop; //function() { stop; }
    };

    

});
