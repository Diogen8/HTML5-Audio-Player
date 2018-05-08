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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBjb250ZXh0ID0gbmV3ICh3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQpKCk7XHJcblxyXG52YXIgYnVmZmVyLHNvdXJjZU5vZGU7XHJcblxyXG52YXIgUGxheWVyID0gbmV3IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNvdXJjZU5vZGUsIGdhaW5Ob2RlO1xyXG4gICAgXHJcbiAgICB2YXIgZ2Fpbk5vZGUgPSBjb250ZXh0LmNyZWF0ZUdhaW4oKTtcclxuICAgIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmNvbnRyb2xzX192b2x1bWVcIikudmFsdWUvMTAwO1xyXG4gICAgZ2Fpbk5vZGUuY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcclxuICAgIFxyXG4gICAgdGhpcy5zdGF0ZSA9IFwiMFwiOyAvL3N0b3BlZCwgcGF1c2VkLCBwbGF5aW5nLCByZXdpbmQsIDAgaXMgaW5pdGlhbCBzdGF0ZVxyXG4gICAgXHJcbiAgICB0aGlzLnBsX3BvczsgLy9wbGF5IHBvc2l0aW9uIG9mIGN1cnJlbnQgdHJhY2tcclxuICAgIFxyXG5cclxuICAgIHRoaXMucGxheSA9IChyZXdpbmRUbykgPT4geyBcclxuICAgICAgICBsZXQgcmV3aW5kX3BvcztcclxuICAgICAgICBpZiAoIWlzRmluaXRlKHJld2luZFRvKSkgcmV3aW5kX3BvcyA9IDA7IGVsc2UgcmV3aW5kX3BvcyA9IHJld2luZFRvOyAvL2luIGNhc2Ugb2YgdHJhc2ggaW4gcmV3aW5kVG9cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT0gXCJwYXVzZWRcIikgdGhpcy5wbF9wb3MgPSAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMucGxfcG9zID0gdGhpcy5wbF9wb3MgKyByZXdpbmRfcG9zO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlICE9IFwicGxheWluZ1wiKSB7XHJcbiAgICAgICAgICAgIGxldCBzY3JpcHROb2RlO1xyXG4gICAgICAgICAgICBjb250ZXh0LnJlc3VtZSgpOyAvL2luIGNhc2Ugb2YgcGF1c2Ugb3Igc3RvcFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT0gXCJwYXVzZWRcIikge1xyXG4gICAgICAgICAgICAgICAgbGV0IHRyYWNrID0gUGxheWxpc3QuZ2V0QWN0aXZlVHJhY2soKTtcclxuICAgICAgICAgICAgICAgIGxldCBidWZmZXIgPSB0cmFjay5idWZlcjtcclxuICAgICAgICAgICAgICAgIGxldCBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xyXG4gICAgICAgICAgICAgICAgc2NyaXB0Tm9kZSA9IGNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKDQwOTYsIDEsIDEpO1xyXG4gICAgICAgICAgICAgICAgc2NyaXB0Tm9kZS5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKCl7fTtcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUub25lbmRlZCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUuY29ubmVjdChzY3JpcHROb2RlKTtcclxuICAgICAgICAgICAgICAgIHNjcmlwdE5vZGUuY29ubmVjdChnYWluTm9kZSk7ICAgIFxyXG4gICAgICAgICAgICAgICAgc291cmNlTm9kZS5jb25uZWN0KGdhaW5Ob2RlKTsgXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VOb2RlLmJ1ZmZlciA9IGJ1ZmZlcjsgIC8vdGhpcyBlYXRzIGEgbG90IG9mIGZ1Y2tpbmcgbWVtb3J5IDsoXHJcblxyXG4gICAgICAgICAgICAgICAgc291cmNlTm9kZS5zdGFydCgwLHJld2luZF9wb3MpO1xyXG4gICAgICAgICAgICAgICAgbGV0IHByb2dyZXNzID0gKHJld2luZF9wb3MpL2J1ZmZlci5kdXJhdGlvbiAqIDEwMDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgc291cmNlTm9kZS5vbmVuZGVkID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChNYXRoLmNlaWwodGhpcy5wbF9wb3MpID49IE1hdGguY2VpbChzb3VyY2VOb2RlLmJ1ZmZlci5kdXJhdGlvbikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV3aW5kX3BvcyA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUuZGlzY29ubmVjdChzY3JpcHROb2RlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0Tm9kZS5kaXNjb25uZWN0KGdhaW5Ob2RlKTsgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUuZGlzY29ubmVjdChnYWluTm9kZSk7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0b3AoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgUGxheWxpc3Quc2V0TmV4dCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXkoKTsgXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT0gXCIwXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBzY3JpcHROb2RlLm9uYXVkaW9wcm9jZXNzID0gKGF1ZGlvUHJvY2Vzc2luZ0V2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50X3RpbWUgPSBhdWRpb1Byb2Nlc3NpbmdFdmVudC5wbGF5YmFja1RpbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxfcG9zID0gdGhpcy5wbF9wb3MgKyBhdWRpb1Byb2Nlc3NpbmdFdmVudC5vdXRwdXRCdWZmZXIuZHVyYXRpb247IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9ncmVzcyA9IHRoaXMucGxfcG9zL3NvdXJjZU5vZGUuYnVmZmVyLmR1cmF0aW9uICogMTAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRpbWVGcm9tU3RhcnQgPSBjdXJyZW50X3RpbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFRpbWVMaW5lLnVwZGF0ZShwcm9ncmVzcyxzb3VyY2VOb2RlLmJ1ZmZlci5kdXJhdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJld2luZF9wb3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuY2hhbmdlU3RhdGUoXCJwbGF5aW5nXCIpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLnBhdXNlID0gKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuY2hhbmdlU3RhdGUoXCJwYXVzZWRcIik7XHJcbiAgICAgICAgY29udGV4dC5zdXNwZW5kKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuc3RvcCA9ICgpID0+IHtcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPSBcInN0b3BlZFwiICYmIHNvdXJjZU5vZGUhPXVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aGlzLmNoYW5nZVN0YXRlKFwic3RvcGVkXCIpO1xyXG4gICAgICAgICAgICBzb3VyY2VOb2RlLnN0b3AoMCk7XHJcbiAgICAgICAgICAgIGNvbnRleHQuc3VzcGVuZCgpO1xyXG4gICAgICAgICAgICBUaW1lTGluZS5yZXNldCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5uZXh0ID0gKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgICAgIFBsYXlsaXN0LnNldE5leHQoKTtcclxuICAgICAgICB0aGlzLnBsYXkoKTtcclxuICAgIH0gICAgXHJcbiAgICBcclxuICAgIHRoaXMucHJldiA9ICgpID0+IHtcclxuICAgICAgICB0aGlzLnN0b3AoKTtcclxuICAgICAgICBQbGF5bGlzdC5zZXRQcmV2KCk7XHJcbiAgICAgICAgdGhpcy5wbGF5KCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuc2V0Vm9sdW1lID0gKHZvbHVtZSkgPT4ge1xyXG4gICAgICAgIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSB2b2x1bWU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMucmV3aW5kVHJhY2sgPSAocG9zKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zdG9wKCk7XHJcbiAgICAgICAgdGhpcy5jaGFuZ2VTdGF0ZShcInJld2luZFwiKTtcclxuICAgICAgICB0aGlzLnBsYXkocG9zKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5jaGFuZ2VTdGF0ZSA9IChuZXdfc3RhdGUpID0+IHtcclxuICAgICAgICB0aGlzLnN0YXRlID0gbmV3X3N0YXRlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBjaGFuZ2VFdmVudCA9IG5ldyBDdXN0b21FdmVudChcInBsYXllclN0YXRlQ2hhbmdlZFwiLCB7XHJcbiAgICAgICAgICAgIGRldGFpbDoge1xyXG4gICAgICAgICAgICAgICAgc3RhdGU6IHRoaXMuc3RhdGVcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGNoYW5nZUV2ZW50KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwbGF5ZXJTdGF0ZUNoYW5nZWRcIiwgKGUpID0+IHtcclxuICAgICAgICAvL3ByZXR0eSBnb29kIHRvIG1ha2UgbmV3IGNvbnRyb2xzIGNsYXNzIGZvciB0aGlzXHJcbiAgICAgICAgdmFyIHBsYXlCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3BsYXknKTtcclxuICAgICAgICB2YXIgcGF1c2VCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3BhdXNlJyk7XHJcbiAgICAgICAgdmFyIHN0b3BCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3N0b3AnKTtcclxuICAgICAgICB2YXIgbmV4dEJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fbmV4dCcpO1xyXG4gICAgICAgIHZhciBwcmV2QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19wcmV2Jyk7XHJcblxyXG4gICAgICAgIGxldCBjb250cm9scyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJjb250cm9sc19fYnV0dG9uXCIpO1xyXG4gICAgICAgIGZvciAobGV0IGk9MDsgaTxjb250cm9scy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb250cm9sc1tpXS5jbGFzc0xpc3QucmVtb3ZlKFwiYWN0aXZlXCIpO1xyXG4gICAgICAgICAgICBjb250cm9sc1tpXS5yZW1vdmVBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3dpdGNoIChlLmRldGFpbC5zdGF0ZSkge1xyXG4gICAgICAgICAgICBjYXNlIFwicGxheWluZ1wiOiB7XHJcbiAgICAgICAgICAgICAgICBwbGF5QnV0dG9uLmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgICBwbGF5QnV0dG9uLmNsYXNzTGlzdC5hZGQoXCJhY3RpdmVcIik7XHJcbiAgICAgICAgICAgICAgICBwbGF5QnV0dG9uLnNldEF0dHJpYnV0ZShcImRpc2FibGVkXCIsXCJkaXNhYmxlZFwiKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNhc2UgXCJwYXVzZWRcIjoge1xyXG4gICAgICAgICAgICAgICAgcGF1c2VCdXR0b24uZm9jdXMoKTtcclxuICAgICAgICAgICAgICAgIHBhdXNlQnV0dG9uLmNsYXNzTGlzdC5hZGQoXCJhY3RpdmVcIik7XHJcbiAgICAgICAgICAgICAgICBwYXVzZUJ1dHRvbi5zZXRBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiLFwiZGlzYWJsZWRcIik7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjYXNlIFwic3RvcGVkXCI6IHtcclxuICAgICAgICAgICAgICAgIHN0b3BCdXR0b24uZm9jdXMoKTtcclxuICAgICAgICAgICAgICAgIHN0b3BCdXR0b24uY2xhc3NMaXN0LmFkZChcImFjdGl2ZVwiKTtcclxuICAgICAgICAgICAgICAgIHN0b3BCdXR0b24uc2V0QXR0cmlidXRlKFwiZGlzYWJsZWRcIixcImRpc2FibGVkXCIpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuXHJcbnZhciBUaW1lTGluZSA9IG5ldyBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0aW1lX2xpbmUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudGltZS1saW5lJyk7XHJcbiAgICB2YXIgcmV3aW5kX2NvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fcmV3aW5kJyk7XHJcbiAgICB2YXIgdGltZXJfbWludXRlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy50aW1lciAubWludXRlcycpO1xyXG4gICAgdmFyIHRpbWVyX3NlY29uZHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudGltZXIgLnNlY29uZHMnKTtcclxuICAgIHZhciB0aW1lcl9taWxpc2Vjb25kcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy50aW1lciAubWlsaXNlY29uZHMnKTtcclxuICAgIFxyXG4gICAgdmFyIGRlZmF1bHRfYmFja2dyb3VuZCwgZWxlbWVudF93aWR0aDtcclxuICAgIFxyXG4gICAgdGhpcy5vZmZzZXQgPSAwO1xyXG4gICAgXHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICBcclxuICAgIHRoaXMucmV3aW5kID0gZnVuY3Rpb24ocG9zKSB7XHJcbiAgICAgICAgdGhhdC5vZmZzZXQgPSBwb3M7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMudXBkYXRlID0gKHByb2dyZXNzID0gMCwgZHVyYXRpb24gPSAwKSA9PiB7XHJcbiAgICAgICAgbGV0IHRpbWUgPSBkdXJhdGlvbiAqIHByb2dyZXNzLzEwMDtcclxuICAgICAgICBcclxuICAgICAgICB0aW1lX2xpbmUuc3R5bGVbXCJiYWNrZ3JvdW5kXCJdID0gdGhpcy5tYWluR3JhZGllbnQocHJvZ3Jlc3MpO1xyXG5cclxuICAgICAgICBsZXQgbWludXRlcyA9IE1hdGguZmxvb3IodGltZS82MCk7XHJcbiAgICAgICAgbGV0IHNlY29uZHMgPSBNYXRoLmZsb29yKHRpbWUgLSBtaW51dGVzKjYwKTtcclxuICAgICAgICBsZXQgbWlsaXNlY29uZHMgPSAoKHRpbWUgLSBtaW51dGVzKjYwIC0gc2Vjb25kcykudG9GaXhlZCgyKSAqIDEwMCkudG9GaXhlZCgwKTtcclxuICAgICAgICBpZiAobWludXRlcyA8MTApIG1pbnV0ZXMgPSBcIjBcIittaW51dGVzO1xyXG4gICAgICAgIGlmIChzZWNvbmRzIDwxMCkgc2Vjb25kcyA9IFwiMFwiK3NlY29uZHM7XHJcbiAgICAgICAgaWYgKG1pbGlzZWNvbmRzIDwxMCkgbWlsaXNlY29uZHMgPSBcIjBcIittaWxpc2Vjb25kcztcclxuICAgICAgICB0aW1lcl9taW51dGVzLmlubmVySFRNTCA9IG1pbnV0ZXM7XHJcbiAgICAgICAgdGltZXJfc2Vjb25kcy5pbm5lckhUTUwgPSBzZWNvbmRzO1xyXG4gICAgICAgIHRpbWVyX21pbGlzZWNvbmRzLmlubmVySFRNTCA9IG1pbGlzZWNvbmRzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLnJlc2V0ID0gKCkgPT4ge1xyXG4gICAgICAgIHRpbWVfbGluZS5zdHlsZVtcImJhY2tncm91bmRcIl0gPSB0aGlzLm1haW5HcmFkaWVudCgwKTtcclxuICAgICAgICBcclxuICAgICAgICB0aW1lcl9taW51dGVzLmlubmVySFRNTCA9IFwiMDBcIjtcclxuICAgICAgICB0aW1lcl9zZWNvbmRzLmlubmVySFRNTCA9IFwiMDBcIjtcclxuICAgICAgICB0aW1lcl9taWxpc2Vjb25kcy5pbm5lckhUTUwgPSBcIjAwXCI7XHJcbiAgICAgICAgdGhhdC5yZXdpbmRfb2Zmc2V0ID0gMDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGltZV9saW5lLm9ubW91c2VlbnRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGVsZW1lbnRfd2lkdGggPSBnZXRDb21wdXRlZFN0eWxlKHRpbWVfbGluZSkud2lkdGg7XHJcbiAgICB9XHJcblxyXG4gICAgdGltZV9saW5lLm9ubW91c2Vtb3ZlID0gKGUpID0+IHtcclxuICAgICAgICBsZXQgcG9zID0gZS5vZmZzZXRYIC8gcGFyc2VJbnQoZWxlbWVudF93aWR0aCkgKiAxMDA7XHJcbiAgICAgICAgbGV0IGJnID0gdGhpcy5yZXdpbmRHcmFkaWVudChwb3MpXHJcbiAgICAgICAgcmV3aW5kX2NvbnRhaW5lci5zdHlsZVtcImJhY2tncm91bmRcIl0gPSBiZztcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGltZV9saW5lLm9ubW91c2VvdXQgPSAoKSA9PiB7XHJcbiAgICAgICAgcmV3aW5kX2NvbnRhaW5lci5zdHlsZVtcImJhY2tncm91bmRcIl0gPSBcInRyYW5zcGFyZW50XCI7XHJcbiAgICB9XHJcblxyXG4gICAgdGltZV9saW5lLm9uY2xpY2sgPSAoZSkgPT4ge1xyXG4gICAgICAgIGxldCBwb3MgPSBwYXJzZUludChlLm9mZnNldFgpIC8gcGFyc2VJbnQoZWxlbWVudF93aWR0aCkgKiBQbGF5bGlzdC5nZXRBY3RpdmVUcmFjaygpLmR1cmF0aW9uO1xyXG4gICAgICAgIFBsYXllci5yZXdpbmRUcmFjayhwb3MpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL2p1c3QgaHR0cHM6Ly9nb28uZ2wvUUptU1I1XHJcbiAgICBcclxuICAgIHRoaXMubWFpbkdyYWRpZW50ID0gKHBvcykgPT4ge1xyXG4gICAgICAgIGxldCBncmFkaWVudCA9IFwiIGxpbmVhci1ncmFkaWVudCh0byBib3R0b20scmdiYSgwLDAsMCwwLjM4KSAwJSxyZ2JhKDAsMCwwLDAuMTgpIDQ4JSxyZ2JhKDAsMCwwLDAuMTgpIDUzJSwgcmdiYSgwLDAsMCwwLjM4KSAxMDAlKSxsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQscmdiYSgwLDAsMCwwLjE4KSAwJSwgcmdiYSgwLDAsMCwwLjE4KSBcIitwb3MrXCIlLCAjZWFlYWVhIFwiK3BvcytcIiUsICNlYWVhZWEgMTAwJSlcIjtcclxuICAgICAgICByZXR1cm4gZ3JhZGllbnQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMucmV3aW5kR3JhZGllbnQgPSAocG9zKSA9PiB7XHJcbiAgICAgICAgbGV0IGdyYWRpZW50ID0gXCJsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQsICByZ2JhKDAsMCwwLDAuMTgpIDAlLCAgcmdiYSgwLDAsMCwwLjE4KSBcIitwb3MrXCIlLCB0cmFuc3BhcmVudCBcIitwb3MrXCIlLCB0cmFuc3BhcmVudCAxMDAlKVwiO1xyXG4gICAgICAgIHJldHVybiBncmFkaWVudDtcclxuICAgIH1cclxufVxyXG5cclxudmFyIFBsYXlsaXN0ID0gbmV3IGZ1bmN0aW9uKCkge1xyXG4gICAgbGV0IGJ1ZmZlcjtcclxuICAgIHRoaXMucGxheWxpc3QgPSBbXTtcclxuICAgIFxyXG4gICAgdGhpcy5hY3RpdmVUcmFja0luZGV4ID0gMDtcclxuICAgIFxyXG4gICAgdGhpcy5hZGRUcmFjayA9IChmaWxlKSA9PiB7XHJcbiAgICAgICAgbGV0IHRyYWNrID0gbmV3IFRyYWNrKGZpbGUpO1xyXG4gICAgICAgIGxvYWRTb3VuZCh0cmFjay50cmFja1VSTCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIHRyYWNrLmJ1ZmVyID0gYnVmZmVyO1xyXG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IGJ1ZmZlci5kdXJhdGlvbjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMucGxheWxpc3QucHVzaCh0cmFjayk7XHJcbiAgICAgICAgICAgIGNyZWF0ZVRyYWNrSFRNTCh0cmFjayk7XHJcbiAgICAgICAgICAgICBsZXQgY2hhbmdlRXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoXCJwbGF5bGlzdFN0YXRlQ2hhbmdlZFwiLCB7XHJcbiAgICAgICAgICAgICAgICBkZXRhaWw6IHtcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZTogdGhpcy5wbGF5bGlzdC5sZW5ndGhcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChjaGFuZ2VFdmVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICBcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5nZXRBY3RpdmVUcmFjayA9ICgpID0+IHtcclxuICAgICAgICB0aGlzLnNldEFjdGl2ZVRyYWNrKHRoaXMucGxheWxpc3RbdGhpcy5hY3RpdmVUcmFja0luZGV4XSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucGxheWxpc3RbdGhpcy5hY3RpdmVUcmFja0luZGV4XTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5zZXRBY3RpdmVUcmFjayA9ICh0cmFjaykgPT4ge1xyXG4gICAgICAgIGxldCBhbGxUcmFja3MgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwidHJhY2tcIik7XHJcbiAgICAgICAgZm9yIChsZXQgaT0wOyBpPGFsbFRyYWNrcy5sZW5ndGg7aSsrKSB7XHJcbiAgICAgICAgICAgIGFsbFRyYWNrc1tpXS5jbGFzc0xpc3QucmVtb3ZlKFwiYWN0aXZlXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmFjdGl2ZVRyYWNrSW5kZXggPSB0aGlzLnBsYXlsaXN0LmluZGV4T2YodHJhY2spO1xyXG4gICAgICAgIGxldCB0cmFja1VybCA9IHRoaXMucGxheWxpc3RbdGhpcy5hY3RpdmVUcmFja0luZGV4XS50cmFja1VSTDtcclxuICAgICAgICBsZXQgdHJhY2tDb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnRyYWNrW2RhdGEtZmlsZXVybD1cXCdcIit0cmFja1VybCtcIlxcJ11cIik7XHJcbiAgICAgICAgdHJhY2tDb250YWluZXIuY2xhc3NMaXN0LmFkZChcImFjdGl2ZVwiKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5zZXROZXh0ID0gKCkgPT4ge1xyXG4gICAgICAgIGxldCBwbGF5bGlzdF9sZW5naHQgPSB0aGlzLnBsYXlsaXN0Lmxlbmd0aDtcclxuICAgICAgICBsZXQgbmV4dCA9IHRoaXMuYWN0aXZlVHJhY2tJbmRleCArIDE7XHJcbiAgICAgICAgaWYgKCh0aGlzLmFjdGl2ZVRyYWNrSW5kZXgrMSkgPiAocGxheWxpc3RfbGVuZ2h0LTEpKSBuZXh0ID0gMDtcclxuICAgICAgICB0aGlzLnNldEFjdGl2ZVRyYWNrKHRoaXMucGxheWxpc3RbbmV4dF0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLnNldFByZXYgPSAoKSA9PiB7XHJcbiAgICAgICAgbGV0IHBsYXlsaXN0X2xlbmdodCA9IHRoaXMucGxheWxpc3QubGVuZ3RoO1xyXG4gICAgICAgIGxldCBwcmV2ID0gdGhpcy5hY3RpdmVUcmFja0luZGV4IC0gMTtcclxuICAgICAgICBpZiAoKHRoaXMuYWN0aXZlVHJhY2tJbmRleCAtIDEpIDwgMCAmJiBwbGF5bGlzdF9sZW5naHQgIT0gMCApIHByZXYgPSBwbGF5bGlzdF9sZW5naHQtMTtcclxuICAgICAgICBpZiAoKHRoaXMuYWN0aXZlVHJhY2tJbmRleCAtIDEpIDwgMCAmJiBwbGF5bGlzdF9sZW5naHQgPT0gMCApIHByZXYgPSAwO1xyXG4gICAgICAgICB0aGlzLnNldEFjdGl2ZVRyYWNrKHRoaXMucGxheWxpc3RbcHJldl0pO1xyXG5cclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5kZWxldGVUcmFjayA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIC8vZm9yIHRoZSBmdXR1cmUgdXNlICkpXHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVRyYWNrSFRNTCh0cmFjaykge1xyXG4gICAgICAgIGxldCBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uO1xyXG4gICAgICAgIGxldCB0aW1lID0gbmV3IERhdGUobnVsbCk7XHJcbiAgICAgICAgbGV0IG5hbWUgPSB0cmFjay5uYW1lO1xyXG4gICAgICAgIGxldCB1cmwgPSB0cmFjay50cmFja1VSTDtcclxuICAgICAgICBsZXQgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgIGxldCBwbGF5bGlzdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWxpc3RfX3RyYWNrc1wiKTtcclxuICAgICAgICBcclxuICAgICAgICB0aW1lLnNldFNlY29uZHMoZHVyYXRpb24pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGR1cmF0aW9uID0gdGltZS5nZXRNaW51dGVzKCkrXCI6XCIrdGltZS5nZXRTZWNvbmRzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29udGFpbmVyLmNsYXNzTmFtZT0ncGxheWxpc3RfX2l0ZW0gdHJhY2snO1xyXG4gICAgICAgIGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2RhdGEtZmlsZVVybCcsdXJsKTtcclxuICAgICAgICBcclxuICAgICAgICBsZXQgdHJhY2tfX25hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJhY2tfX25hbWUuY2xhc3NOYW1lID0gJ3RyYWNrX19uYW1lJztcclxuICAgICAgICB0cmFja19fbmFtZS5pbm5lckhUTUwgPSBuYW1lO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCB0cmFja19fZHVyYXRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJhY2tfX2R1cmF0aW9uLmNsYXNzTmFtZSA9ICd0cmFja19fZHVyYXRpb24nO1xyXG4gICAgICAgIHRyYWNrX19kdXJhdGlvbi5pbm5lckhUTUwgPSBkdXJhdGlvbjtcclxuICAgICAgICBcclxuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodHJhY2tfX25hbWUpO1xyXG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0cmFja19fZHVyYXRpb24pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHBsYXlsaXN0LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICBQbGF5bGlzdC5zZXRBY3RpdmVUcmFjayh0cmFjaylcclxuICAgICAgICAgICAgaWYgKFBsYXllci5zdGF0ZSA9PSBcInBsYXlpbmdcIiB8fCBQbGF5ZXIuc3RhdGUgPT0gXCJwYXVzZWRcIikgUGxheWVyLnN0b3AoKTtcclxuICAgICAgICAgICAgUGxheWVyLnBsYXkoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZGVsZXRlVHJhY2tIVE1MKCkge1xyXG4gICAgICAgIC8vZm9yIGZ1dHVyZSB1c2VcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbG9hZFNvdW5kKHVybCkge1xyXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSxyZWplY3Qpe1xyXG4gICAgICAgICAgICAvL3RoaXMgbG9hZHMgYXN5bmNocm9ub3VzbHlcclxuICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgICAgICAgICAgcmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xyXG5cclxuICAgICAgICAgICAgLy9hc3luY2hyb25vdXMgY2FsbGJhY2tcclxuICAgICAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdsb2FkIGZpbmlzaGVkJyk7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXVkaW9EYXRhID0gcmVxdWVzdC5yZXNwb25zZTtcclxuICAgICAgICAgICAgICAgIC8vYW5vdGhlciBhc3luY1xyXG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWNvZGVBdWRpb0RhdGEoYXVkaW9EYXRhKS50aGVuKChkZWNvZGVkRGF0YSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoYnVmZmVyID0gZGVjb2RlZERhdGEpO1xyXG4gICAgICAgICAgICAgICAgfSwgKCkgPT4ge2NvbnNvbGUubG9nKFwiZGVjb2RpbmcgZXJyb3JcIik7fSk7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICByZXF1ZXN0LnNlbmQoKTtcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwbGF5bGlzdFN0YXRlQ2hhbmdlZFwiLCAoZSkgPT4ge1xyXG4gICAgICAgIGlmIChlLmRldGFpbC5zdGF0ZSAhPSAwKSB7XHJcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWVyX19jb250cm9sc1wiKS5jbGFzc0xpc3QucmVtb3ZlKFwiZGlzYWJsZWRcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXllcl9fY29udHJvbHNcIikuY2xhc3NMaXN0LmFkZChcImRpc2FibGVkXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG52YXIgVHJhY2sgPSBmdW5jdGlvbihmaWxlKSB7XHJcbiAgICBsZXQgdXJsID0gIFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZSk7XHJcbiAgICBcclxuICAgIHRoaXMuZHVyYXRpb24gPSAwO1xyXG4gICAgXHJcbiAgICB0aGlzLnRyYWNrVVJMID0gdXJsO1xyXG4gICAgXHJcbiAgICB0aGlzLm5hbWUgPSBmaWxlLm5hbWUuc3Vic3RyaW5nKDAsZmlsZS5uYW1lLmxlbmd0aC00KTtcclxuICAgIFxyXG4gICAgdGhpcy5idWZlciA9IG51bGw7XHJcbiAgICBcclxuICAgIHRoaXMuY29udGFpbmVyID0gbnVsbDtcclxufVxyXG5cclxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tY29udHJvbHMtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS8vXHJcblxyXG52YXIgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fcGxheScpO1xyXG52YXIgcGF1c2VCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3BhdXNlJyk7XHJcbnZhciBzdG9wQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19zdG9wJyk7XHJcbnZhciBuZXh0QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19uZXh0Jyk7XHJcbnZhciBwcmV2QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19wcmV2Jyk7XHJcblxyXG52YXIgdm9sdW1lY29udHJvbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY29udHJvbHNfX3ZvbHVtZVwiKTtcclxuXHJcbnZvbHVtZWNvbnRyb2wuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoZSkgPT4ge1xyXG4gICAgUGxheWVyLnNldFZvbHVtZSh2b2x1bWVjb250cm9sLnZhbHVlLzEwMCk7XHJcbn0pXHJcblxyXG5wbGF5QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxQbGF5ZXIucGxheSk7XHJcbnBhdXNlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxQbGF5ZXIucGF1c2UpO1xyXG5zdG9wQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxQbGF5ZXIuc3RvcCk7XHJcbm5leHRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLFBsYXllci5uZXh0KTtcclxucHJldkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsUGxheWVyLnByZXYpO1xyXG5cclxudmFyIGZpbGVfaW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmlsZScpO1xyXG5cclxuIGZpbGVfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoZSkgPT4ge1xyXG4gICAgY29uc29sZS5sb2coJ2FzZGFzZHNhZCcsIGZpbGVfaW5wdXQuZmlsZXMpO1xyXG4gICAgIGxldCBmaWxlID0gZmlsZV9pbnB1dC5maWxlc1swXTtcclxuICAgICBpZiAoZmlsZUNoZWNrKGZpbGUpKSB7XHJcbiAgICAgICAgICBQbGF5bGlzdC5hZGRUcmFjayhmaWxlKTtcclxuICAgICB9XHJcbiAgICAgZWxzZSB7XHJcbiAgICAgICAgIGFsZXJ0KFwiYWxsb3dlZCBvbmx5IE1QMywgV0FWIGFuZCBPR0cgZmlsZXMgbGVzcyB0aGFuIDE1TWJcIik7XHJcbiAgICAgfVxyXG4gICAgIFxyXG4gIGUucHJldmVudERlZmF1bHQoKTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiBmaWxlQ2hlY2soZmlsZSkge1xyXG4gICAgbGV0IHJlc3VsdCA9IGZhbHNlO1xyXG4gICAgaWYgKGZpbGUuc2l6ZSA8IDE1NzI4NjQwKSB7XHJcbiAgICAgICAgdmFyIHBhcnRzID0gKGZpbGUubmFtZSkuc3BsaXQoXCIuXCIpO1xyXG4gICAgICAgIHZhciBleHQgPSBwYXJ0c1twYXJ0cy5sZW5ndGgtMV07XHJcbiAgICAgICAgdmFyIG1pbWVUeXBlID0gZmlsZS50eXBlO1xyXG4gICAgICAgIHZhciBhbGxvd2VkRXh0ID0gW1wibXAzXCIsXCJvZ2dcIixcIndhdlwiXTtcclxuICAgICAgICB2YXIgYWxsb3dlZE1JTUUgPSBbXCJhdWRpby9tcGVnXCIsXCJhdWRpby9vZ2dcIixcImF1ZGlvL3dhdlwiXTtcclxuICAgICAgICBpZiAoYWxsb3dlZEV4dC5pbmNsdWRlcyhleHQudG9Mb3dlckNhc2UoKSkgfHwgYWxsb3dlZE1JTUUuaW5jbHVkZXMobWltZVR5cGUudG9Mb3dlckNhc2UoKSkpIHJlc3VsdCA9IHRydWU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PSAxKSByZXN1bHQgPSB0cnVlOyAvL2EgaG9sZSBmb3IgbW9iaWxlXHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59Il0sImZpbGUiOiJtYWluLmpzIn0=
