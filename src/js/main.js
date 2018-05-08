'use strict';

var context = new (window.AudioContext || window.webkitAudioContext)();

var buffer,sourceNode;

var Player = new function() {
    var sourceNode, gainNode;
    
    var gainNode = context.createGain();
    gainNode.gain.value = document.querySelector(".controls__volume").value/100;
    gainNode.connect(context.destination);
    
    this.state = "0"; //stoped, paused, playing, rewind, 0 is initial state
    
    this.pl_pos; //play position of current track
    

    this.play = (rewindTo) => { 
        let rewind_pos;
        if (!isFinite(rewindTo)) rewind_pos = 0; else rewind_pos = rewindTo; //in case of trash in rewindTo
            
        if (this.state != "paused") this.pl_pos = 0;
        
        this.pl_pos = this.pl_pos + rewind_pos;
        
        if (this.state != "playing") {
            let scriptNode;
            context.resume(); //in case of pause or stop
            
            if (this.state != "paused") {
                let track = Playlist.getActiveTrack();
                let buffer = track.bufer;
                let duration = track.duration;
            
                sourceNode = context.createBufferSource();
                scriptNode = context.createScriptProcessor(4096, 1, 1);
                scriptNode.onaudioprocess = function(){};
                sourceNode.onended = null;
                
                sourceNode.connect(scriptNode);
                scriptNode.connect(gainNode);    
                sourceNode.connect(gainNode); 
                sourceNode.buffer = buffer;  //this eats a lot of fucking memory ;(

                sourceNode.start(0,rewind_pos);
                let progress = (rewind_pos)/buffer.duration * 100;
                
                sourceNode.onended = () => {
                    if (Math.ceil(this.pl_pos) >= Math.ceil(sourceNode.buffer.duration)) {
                        rewind_pos = 0;
                        sourceNode.disconnect(scriptNode);
                        scriptNode.disconnect(gainNode);    
                        sourceNode.disconnect(gainNode); 
                        this.stop();
                        Playlist.setNext();
                        this.play(); 
                    }
                };
                
                if (this.state == "0") {
                    scriptNode.onaudioprocess = (audioProcessingEvent) => {
                        let current_time = audioProcessingEvent.playbackTime;
                        this.pl_pos = this.pl_pos + audioProcessingEvent.outputBuffer.duration; 
                        progress = this.pl_pos/sourceNode.buffer.duration * 100;
                        this.timeFromStart = current_time;
                        TimeLine.update(progress,sourceNode.buffer.duration);
                        rewind_pos = 0;
                    }
                }
        }
            
    }
        
        this.changeState("playing");
    }
    
    this.pause = () => {
        this.changeState("paused");
        context.suspend();
    }
    
    this.stop = () => {
        if (this.state != "stoped" && sourceNode!=undefined) {
            this.changeState("stoped");
            sourceNode.stop(0);
            context.suspend();
            TimeLine.reset();
        }
    }
    
    this.next = () => {
        this.stop();
        Playlist.setNext();
        this.play();
    }    
    
    this.prev = () => {
        this.stop();
        Playlist.setPrev();
        this.play();
    }
    
    this.setVolume = (volume) => {
        gainNode.gain.value = volume;
    }
    
    this.rewindTrack = (pos) => {
        this.stop();
        this.changeState("rewind");
        this.play(pos);
    }
    
    this.changeState = (new_state) => {
        this.state = new_state;
        
        let changeEvent = new CustomEvent("playerStateChanged", {
            detail: {
                state: this.state
            }
        });
        
        window.dispatchEvent(changeEvent);
    }
    
    window.addEventListener("playerStateChanged", (e) => {
        //pretty good to make new controls class for this
        var playButton = document.querySelector('.controls__play');
        var pauseButton = document.querySelector('.controls__pause');
        var stopButton = document.querySelector('.controls__stop');
        var nextButton = document.querySelector('.controls__next');
        var prevButton = document.querySelector('.controls__prev');

        let controls = document.getElementsByClassName("controls__button");
        for (let i=0; i<controls.length; i++) {
            controls[i].classList.remove("active");
            controls[i].removeAttribute("disabled");
        }
        switch (e.detail.state) {
            case "playing": {
                playButton.focus();
                playButton.classList.add("active");
                playButton.setAttribute("disabled","disabled");
                
                break;
            };
            case "paused": {
                pauseButton.focus();
                pauseButton.classList.add("active");
                pauseButton.setAttribute("disabled","disabled");
                
                break;
            };
            case "stoped": {
                stopButton.focus();
                stopButton.classList.add("active");
                stopButton.setAttribute("disabled","disabled");
                
                break;
            }
                
        }
    });
}

var TimeLine = new function() {
    var time_line = document.querySelector('.time-line');
    var rewind_container = document.querySelector('.controls__rewind');
    var timer_minutes = document.querySelector('.timer .minutes');
    var timer_seconds = document.querySelector('.timer .seconds');
    var timer_miliseconds = document.querySelector('.timer .miliseconds');
    
    var default_background, element_width;
    
    this.offset = 0;
    
    var that = this;
    
    this.rewind = function(pos) {
        that.offset = pos;
    }
    
    this.update = (progress = 0, duration = 0) => {
        let time = duration * progress/100;
        
        time_line.style["background"] = this.mainGradient(progress);

        let minutes = Math.floor(time/60);
        let seconds = Math.floor(time - minutes*60);
        let miliseconds = ((time - minutes*60 - seconds).toFixed(2) * 100).toFixed(0);
        if (minutes <10) minutes = "0"+minutes;
        if (seconds <10) seconds = "0"+seconds;
        if (miliseconds <10) miliseconds = "0"+miliseconds;
        timer_minutes.innerHTML = minutes;
        timer_seconds.innerHTML = seconds;
        timer_miliseconds.innerHTML = miliseconds;
    }
    
    this.reset = () => {
        time_line.style["background"] = this.mainGradient(0);
        
        timer_minutes.innerHTML = "00";
        timer_seconds.innerHTML = "00";
        timer_miliseconds.innerHTML = "00";
        that.rewind_offset = 0;
    }
    
    time_line.onmouseenter = function() {
        element_width = getComputedStyle(time_line).width;
    }

    time_line.onmousemove = (e) => {
        let pos = e.offsetX / parseInt(element_width) * 100;
        let bg = this.rewindGradient(pos)
        rewind_container.style["background"] = bg;
    }
    
    time_line.onmouseout = () => {
        rewind_container.style["background"] = "transparent";
    }

    time_line.onclick = (e) => {
        let pos = parseInt(e.offsetX) / parseInt(element_width) * Playlist.getActiveTrack().duration;
        Player.rewindTrack(pos);
    }
    
    //just https://goo.gl/QJmSR5
    
    this.mainGradient = (pos) => {
        let gradient = " linear-gradient(to bottom,rgba(0,0,0,0.38) 0%,rgba(0,0,0,0.18) 48%,rgba(0,0,0,0.18) 53%, rgba(0,0,0,0.38) 100%),linear-gradient(to right,rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.18) "+pos+"%, #eaeaea "+pos+"%, #eaeaea 100%)";
        return gradient;
    }
    
    this.rewindGradient = (pos) => {
        let gradient = "linear-gradient(to right,  rgba(0,0,0,0.18) 0%,  rgba(0,0,0,0.18) "+pos+"%, transparent "+pos+"%, transparent 100%)";
        return gradient;
    }
}

var Playlist = new function() {
    let buffer;
    this.playlist = [];
    
    this.activeTrackIndex = 0;
    
    this.addTrack = (file) => {
        let track = new Track(file);
        loadSound(track.trackURL).then(() => {
            track.bufer = buffer;
            track.duration = buffer.duration;
            
            this.playlist.push(track);
            createTrackHTML(track);
             let changeEvent = new CustomEvent("playlistStateChanged", {
                detail: {
                    state: this.playlist.length
                }
            });
            
            window.dispatchEvent(changeEvent);
        });
       
    }
    
    this.getActiveTrack = () => {
        this.setActiveTrack(this.playlist[this.activeTrackIndex]);
        return this.playlist[this.activeTrackIndex];
    }
    
    this.setActiveTrack = (track) => {
        let allTracks = document.getElementsByClassName("track");
        for (let i=0; i<allTracks.length;i++) {
            allTracks[i].classList.remove("active");
        }
        this.activeTrackIndex = this.playlist.indexOf(track);
        let trackUrl = this.playlist[this.activeTrackIndex].trackURL;
        let trackContainer = document.querySelector(".track[data-fileurl=\'"+trackUrl+"\']");
        trackContainer.classList.add("active");
    }
    
    this.setNext = () => {
        let playlist_lenght = this.playlist.length;
        let next = this.activeTrackIndex + 1;
        if ((this.activeTrackIndex+1) > (playlist_lenght-1)) next = 0;
        this.setActiveTrack(this.playlist[next]);
    }
    
    this.setPrev = () => {
        let playlist_lenght = this.playlist.length;
        let prev = this.activeTrackIndex - 1;
        if ((this.activeTrackIndex - 1) < 0 && playlist_lenght != 0 ) prev = playlist_lenght-1;
        if ((this.activeTrackIndex - 1) < 0 && playlist_lenght == 0 ) prev = 0;
         this.setActiveTrack(this.playlist[prev]);

    }
    
    this.deleteTrack = function() {
        //for the future use ))
    }
    
    function createTrackHTML(track) {
        let duration = track.duration;
        let time = new Date(null);
        let name = track.name;
        let url = track.trackURL;
        let container = document.createElement('span');
        let playlist = document.querySelector(".playlist__tracks");
        
        time.setSeconds(duration);
        
        duration = time.getMinutes()+":"+time.getSeconds();
        
        container.className='playlist__item track';
        container.setAttribute('data-fileUrl',url);
        
        let track__name = document.createElement('span');
        
        track__name.className = 'track__name';
        track__name.innerHTML = name;
        
        let track__duration = document.createElement('span');
        
        track__duration.className = 'track__duration';
        track__duration.innerHTML = duration;
        
        container.appendChild(track__name);
        container.appendChild(track__duration);
        
        playlist.appendChild(container);
        
        container.addEventListener("click", (e) => {
            Playlist.setActiveTrack(track)
            if (Player.state == "playing" || Player.state == "paused") Player.stop();
            Player.play();
        });
    }
    
    function deleteTrackHTML() {
        //for future use
    }
    
    function loadSound(url) {
        var promise = new Promise(function(resolve,reject){
            //this loads asynchronously
            var request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.responseType = "arraybuffer";

            //asynchronous callback
            request.onload = function() {
                console.log('load finished');
                var audioData = request.response;
                //another async
                context.decodeAudioData(audioData).then((decodedData) => {
                    resolve(buffer = decodedData);
                }, () => {console.log("decoding error");});
            };

            request.send();
        })

        return promise;
    }
    
    window.addEventListener("playlistStateChanged", (e) => {
        if (e.detail.state != 0) {
            document.querySelector(".player__controls").classList.remove("disabled");
        }
        else {
            document.querySelector(".player__controls").classList.add("disabled");
        }
    });
}

var Track = function(file) {
    let url =  URL.createObjectURL(file);
    
    this.duration = 0;
    
    this.trackURL = url;
    
    this.name = file.name.substring(0,file.name.length-4);
    
    this.bufer = null;
    
    this.container = null;
}

//----------------------controls-----------------------------//

var playButton = document.querySelector('.controls__play');
var pauseButton = document.querySelector('.controls__pause');
var stopButton = document.querySelector('.controls__stop');
var nextButton = document.querySelector('.controls__next');
var prevButton = document.querySelector('.controls__prev');

var volumecontrol = document.querySelector(".controls__volume");

volumecontrol.addEventListener("change", (e) => {
    Player.setVolume(volumecontrol.value/100);
})

playButton.addEventListener('click',Player.play);
pauseButton.addEventListener('click',Player.pause);
stopButton.addEventListener('click',Player.stop);
nextButton.addEventListener('click',Player.next);
prevButton.addEventListener('click',Player.prev);

var file_input = document.getElementById('file');

 file_input.addEventListener("change", (e) => {
    console.log('asdasdsad', file_input.files);
     let file = file_input.files[0];
     if (fileCheck(file)) {
          Playlist.addTrack(file);
     }
     else {
         alert("allowed only MP3, WAV and OGG files less than 15Mb");
     }
     
  e.preventDefault();
});

function fileCheck(file) {
    let result = false;
    if (file.size < 15728640) {
        var parts = (file.name).split(".");
        var ext = parts[parts.length-1];
        var mimeType = file.type;
        var allowedExt = ["mp3","ogg","wav"];
        var allowedMIME = ["audio/mpeg","audio/ogg","audio/wav"];
        if (allowedExt.includes(ext.toLowerCase()) || allowedMIME.includes(mimeType.toLowerCase())) result = true;
        
        if (parts.length == 1) result = true; //a hole for mobile
    }
    return result;
}