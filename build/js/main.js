'use strict';

var context = new (window.AudioContext || window.webkitAudioContext)();

var buffer, sourceNode;

var Player = new function () {
    var _this = this;

    var sourceNode, gainNode;

    var gainNode = context.createGain();
    gainNode.gain.value = document.querySelector(".controls__volume").value / 100;
    gainNode.connect(context.destination);

    this.state = "0"; //stoped, paused, playing, rewind, 0 is initial state

    this.pl_pos; //play position of current track


    this.play = function (rewindTo) {
        var rewind_pos = void 0;
        if (!isFinite(rewindTo)) rewind_pos = 0;else rewind_pos = rewindTo; //in case of trash in rewindTo

        if (_this.state != "paused") _this.pl_pos = 0;

        _this.pl_pos = _this.pl_pos + rewind_pos;

        if (_this.state != "playing") {
            var scriptNode = void 0;
            context.resume(); //in case of pause or stop

            if (_this.state != "paused") {
                var track = Playlist.getActiveTrack();
                var _buffer = track.bufer;
                var duration = track.duration;

                sourceNode = context.createBufferSource();
                scriptNode = context.createScriptProcessor(4096, 1, 1);
                scriptNode.onaudioprocess = function () {};
                sourceNode.onended = null;

                sourceNode.connect(scriptNode);
                scriptNode.connect(gainNode);
                sourceNode.connect(gainNode);
                sourceNode.buffer = _buffer; //this eats a lot of fucking memory ;(

                sourceNode.start(0, rewind_pos);
                var progress = rewind_pos / _buffer.duration * 100;

                sourceNode.onended = function () {
                    if (Math.ceil(_this.pl_pos) >= Math.ceil(sourceNode.buffer.duration)) {
                        rewind_pos = 0;
                        sourceNode.disconnect(scriptNode);
                        scriptNode.disconnect(gainNode);
                        sourceNode.disconnect(gainNode);
                        _this.stop();
                        Playlist.setNext();
                        _this.play();
                    }
                };

                if (_this.state == "0") {
                    scriptNode.onaudioprocess = function (audioProcessingEvent) {
                        var current_time = audioProcessingEvent.playbackTime;
                        _this.pl_pos = _this.pl_pos + audioProcessingEvent.outputBuffer.duration;
                        progress = _this.pl_pos / sourceNode.buffer.duration * 100;
                        _this.timeFromStart = current_time;
                        TimeLine.update(progress, sourceNode.buffer.duration);
                        rewind_pos = 0;
                    };
                }
            }
        }

        _this.changeState("playing");
    };

    this.pause = function () {
        _this.changeState("paused");
        context.suspend();
    };

    this.stop = function () {
        if (_this.state != "stoped" && sourceNode != undefined) {
            _this.changeState("stoped");
            sourceNode.stop(0);
            context.suspend();
            TimeLine.reset();
        }
    };

    this.next = function () {
        _this.stop();
        Playlist.setNext();
        _this.play();
    };

    this.prev = function () {
        _this.stop();
        Playlist.setPrev();
        _this.play();
    };

    this.setVolume = function (volume) {
        gainNode.gain.value = volume;
    };

    this.rewindTrack = function (pos) {
        _this.stop();
        _this.changeState("rewind");
        _this.play(pos);
    };

    this.changeState = function (new_state) {
        _this.state = new_state;

        var changeEvent = new CustomEvent("playerStateChanged", {
            detail: {
                state: _this.state
            }
        });

        window.dispatchEvent(changeEvent);
    };

    window.addEventListener("playerStateChanged", function (e) {
        //pretty good to make new controls class for this
        var playButton = document.querySelector('.controls__play');
        var pauseButton = document.querySelector('.controls__pause');
        var stopButton = document.querySelector('.controls__stop');
        var nextButton = document.querySelector('.controls__next');
        var prevButton = document.querySelector('.controls__prev');

        var controls = document.getElementsByClassName("controls__button");
        for (var i = 0; i < controls.length; i++) {
            controls[i].classList.remove("active");
            controls[i].removeAttribute("disabled");
        }
        switch (e.detail.state) {
            case "playing":
                {
                    playButton.focus();
                    playButton.classList.add("active");
                    playButton.setAttribute("disabled", "disabled");

                    break;
                };
            case "paused":
                {
                    pauseButton.focus();
                    pauseButton.classList.add("active");
                    pauseButton.setAttribute("disabled", "disabled");

                    break;
                };
            case "stoped":
                {
                    stopButton.focus();
                    stopButton.classList.add("active");
                    stopButton.setAttribute("disabled", "disabled");

                    break;
                }

        }
    });
}();

var TimeLine = new function () {
    var _this2 = this;

    var time_line = document.querySelector('.time-line');
    var rewind_container = document.querySelector('.controls__rewind');
    var timer_minutes = document.querySelector('.timer .minutes');
    var timer_seconds = document.querySelector('.timer .seconds');
    var timer_miliseconds = document.querySelector('.timer .miliseconds');

    var default_background, element_width;

    this.offset = 0;

    var that = this;

    this.rewind = function (pos) {
        that.offset = pos;
    };

    this.update = function () {
        var progress = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

        var time = duration * progress / 100;

        time_line.style["background"] = _this2.mainGradient(progress);

        var minutes = Math.floor(time / 60);
        var seconds = Math.floor(time - minutes * 60);
        var miliseconds = ((time - minutes * 60 - seconds).toFixed(2) * 100).toFixed(0);
        if (minutes < 10) minutes = "0" + minutes;
        if (seconds < 10) seconds = "0" + seconds;
        if (miliseconds < 10) miliseconds = "0" + miliseconds;
        timer_minutes.innerHTML = minutes;
        timer_seconds.innerHTML = seconds;
        timer_miliseconds.innerHTML = miliseconds;
    };

    this.reset = function () {
        time_line.style["background"] = _this2.mainGradient(0);

        timer_minutes.innerHTML = "00";
        timer_seconds.innerHTML = "00";
        timer_miliseconds.innerHTML = "00";
        that.rewind_offset = 0;
    };

    time_line.onmouseenter = function () {
        element_width = getComputedStyle(time_line).width;
    };

    time_line.onmousemove = function (e) {
        var pos = e.offsetX / parseInt(element_width) * 100;
        var bg = _this2.rewindGradient(pos);
        rewind_container.style["background"] = bg;
    };

    time_line.onmouseout = function () {
        rewind_container.style["background"] = "transparent";
    };

    time_line.onclick = function (e) {
        var pos = parseInt(e.offsetX) / parseInt(element_width) * Playlist.getActiveTrack().duration;
        Player.rewindTrack(pos);
    };

    //just https://goo.gl/QJmSR5

    this.mainGradient = function (pos) {
        var gradient = " linear-gradient(to bottom,rgba(0,0,0,0.38) 0%,rgba(0,0,0,0.18) 48%,rgba(0,0,0,0.18) 53%, rgba(0,0,0,0.38) 100%),linear-gradient(to right,rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.18) " + pos + "%, #eaeaea " + pos + "%, #eaeaea 100%)";
        return gradient;
    };

    this.rewindGradient = function (pos) {
        var gradient = "linear-gradient(to right,  rgba(0,0,0,0.18) 0%,  rgba(0,0,0,0.18) " + pos + "%, transparent " + pos + "%, transparent 100%)";
        return gradient;
    };
}();

var Playlist = new function () {
    var _this3 = this;

    var buffer = void 0;
    this.playlist = [];

    this.activeTrackIndex = 0;

    this.addTrack = function (file) {
        var track = new Track(file);
        loadSound(track.trackURL).then(function () {
            track.bufer = buffer;
            track.duration = buffer.duration;

            _this3.playlist.push(track);
            createTrackHTML(track);
            var changeEvent = new CustomEvent("playlistStateChanged", {
                detail: {
                    state: _this3.playlist.length
                }
            });

            window.dispatchEvent(changeEvent);
        });
    };

    this.getActiveTrack = function () {
        _this3.setActiveTrack(_this3.playlist[_this3.activeTrackIndex]);
        return _this3.playlist[_this3.activeTrackIndex];
    };

    this.setActiveTrack = function (track) {
        var allTracks = document.getElementsByClassName("track");
        for (var i = 0; i < allTracks.length; i++) {
            allTracks[i].classList.remove("active");
        }
        _this3.activeTrackIndex = _this3.playlist.indexOf(track);
        var trackUrl = _this3.playlist[_this3.activeTrackIndex].trackURL;
        var trackContainer = document.querySelector(".track[data-fileurl=\'" + trackUrl + "\']");
        trackContainer.classList.add("active");
    };

    this.setNext = function () {
        var playlist_lenght = _this3.playlist.length;
        var next = _this3.activeTrackIndex + 1;
        if (_this3.activeTrackIndex + 1 > playlist_lenght - 1) next = 0;
        _this3.setActiveTrack(_this3.playlist[next]);
    };

    this.setPrev = function () {
        var playlist_lenght = _this3.playlist.length;
        var prev = _this3.activeTrackIndex - 1;
        if (_this3.activeTrackIndex - 1 < 0 && playlist_lenght != 0) prev = playlist_lenght - 1;
        if (_this3.activeTrackIndex - 1 < 0 && playlist_lenght == 0) prev = 0;
        _this3.setActiveTrack(_this3.playlist[prev]);
    };

    this.deleteTrack = function () {
        //for the future use ))
    };

    function createTrackHTML(track) {
        var duration = track.duration;
        var time = new Date(null);
        var name = track.name;
        var url = track.trackURL;
        var container = document.createElement('span');
        var playlist = document.querySelector(".playlist__tracks");

        time.setSeconds(duration);

        duration = time.getMinutes() + ":" + time.getSeconds();

        container.className = 'playlist__item track';
        container.setAttribute('data-fileUrl', url);

        var track__name = document.createElement('span');

        track__name.className = 'track__name';
        track__name.innerHTML = name;

        var track__duration = document.createElement('span');

        track__duration.className = 'track__duration';
        track__duration.innerHTML = duration;

        container.appendChild(track__name);
        container.appendChild(track__duration);

        playlist.appendChild(container);

        container.addEventListener("click", function (e) {
            Playlist.setActiveTrack(track);
            if (Player.state == "playing" || Player.state == "paused") Player.stop();
            Player.play();
        });
    }

    function deleteTrackHTML() {
        //for future use
    }

    function loadSound(url) {
        var promise = new Promise(function (resolve, reject) {
            //this loads asynchronously
            var request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.responseType = "arraybuffer";

            //asynchronous callback
            request.onload = function () {
                console.log('load finished');
                var audioData = request.response;
                //another async
                context.decodeAudioData(audioData).then(function (decodedData) {
                    resolve(buffer = decodedData);
                }, function () {
                    console.log("decoding error");
                });
            };

            request.send();
        });

        return promise;
    }

    window.addEventListener("playlistStateChanged", function (e) {
        if (e.detail.state != 0) {
            document.querySelector(".player__controls").classList.remove("disabled");
        } else {
            document.querySelector(".player__controls").classList.add("disabled");
        }
    });
}();

var Track = function Track(file) {
    var url = URL.createObjectURL(file);

    this.duration = 0;

    this.trackURL = url;

    this.name = file.name.substring(0, file.name.length - 4);

    this.bufer = null;

    this.container = null;
};

//----------------------controls-----------------------------//

var playButton = document.querySelector('.controls__play');
var pauseButton = document.querySelector('.controls__pause');
var stopButton = document.querySelector('.controls__stop');
var nextButton = document.querySelector('.controls__next');
var prevButton = document.querySelector('.controls__prev');

var volumecontrol = document.querySelector(".controls__volume");

volumecontrol.addEventListener("change", function (e) {
    Player.setVolume(volumecontrol.value / 100);
});

playButton.addEventListener('click', Player.play);
pauseButton.addEventListener('click', Player.pause);
stopButton.addEventListener('click', Player.stop);
nextButton.addEventListener('click', Player.next);
prevButton.addEventListener('click', Player.prev);

var file_input = document.getElementById('file');

file_input.addEventListener("change", function (e) {
    console.log('asdasdsad', file_input.files);
    var file = file_input.files[0];
    if (fileCheck(file)) {
        Playlist.addTrack(file);
    } else {
        alert("allowed only MP3, WAV and OGG files less than 15Mb");
    }

    e.preventDefault();
});

function fileCheck(file) {
    var result = false;
    if (file.size < 15728640) {
        var parts = file.name.split(".");
        var ext = parts[parts.length - 1];
        var mimeType = file.type;
        var allowedExt = ["mp3", "ogg", "wav"];
        var allowedMIME = ["audio/mpeg", "audio/ogg", "audio/wav"];
        if (allowedExt.includes(ext.toLowerCase()) || allowedMIME.includes(mimeType.toLowerCase())) result = true;

        if (parts.length == 1) result = true; //a hole for mobile
    }
    return result;
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGNvbnRleHQgPSBuZXcgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkoKTtcblxudmFyIGJ1ZmZlciwgc291cmNlTm9kZTtcblxudmFyIFBsYXllciA9IG5ldyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIHZhciBzb3VyY2VOb2RlLCBnYWluTm9kZTtcblxuICAgIHZhciBnYWluTm9kZSA9IGNvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmNvbnRyb2xzX192b2x1bWVcIikudmFsdWUgLyAxMDA7XG4gICAgZ2Fpbk5vZGUuY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgIHRoaXMuc3RhdGUgPSBcIjBcIjsgLy9zdG9wZWQsIHBhdXNlZCwgcGxheWluZywgcmV3aW5kLCAwIGlzIGluaXRpYWwgc3RhdGVcblxuICAgIHRoaXMucGxfcG9zOyAvL3BsYXkgcG9zaXRpb24gb2YgY3VycmVudCB0cmFja1xuXG5cbiAgICB0aGlzLnBsYXkgPSBmdW5jdGlvbiAocmV3aW5kVG8pIHtcbiAgICAgICAgdmFyIHJld2luZF9wb3MgPSB2b2lkIDA7XG4gICAgICAgIGlmICghaXNGaW5pdGUocmV3aW5kVG8pKSByZXdpbmRfcG9zID0gMDtlbHNlIHJld2luZF9wb3MgPSByZXdpbmRUbzsgLy9pbiBjYXNlIG9mIHRyYXNoIGluIHJld2luZFRvXG5cbiAgICAgICAgaWYgKF90aGlzLnN0YXRlICE9IFwicGF1c2VkXCIpIF90aGlzLnBsX3BvcyA9IDA7XG5cbiAgICAgICAgX3RoaXMucGxfcG9zID0gX3RoaXMucGxfcG9zICsgcmV3aW5kX3BvcztcblxuICAgICAgICBpZiAoX3RoaXMuc3RhdGUgIT0gXCJwbGF5aW5nXCIpIHtcbiAgICAgICAgICAgIHZhciBzY3JpcHROb2RlID0gdm9pZCAwO1xuICAgICAgICAgICAgY29udGV4dC5yZXN1bWUoKTsgLy9pbiBjYXNlIG9mIHBhdXNlIG9yIHN0b3BcblxuICAgICAgICAgICAgaWYgKF90aGlzLnN0YXRlICE9IFwicGF1c2VkXCIpIHtcbiAgICAgICAgICAgICAgICB2YXIgdHJhY2sgPSBQbGF5bGlzdC5nZXRBY3RpdmVUcmFjaygpO1xuICAgICAgICAgICAgICAgIHZhciBfYnVmZmVyID0gdHJhY2suYnVmZXI7XG4gICAgICAgICAgICAgICAgdmFyIGR1cmF0aW9uID0gdHJhY2suZHVyYXRpb247XG5cbiAgICAgICAgICAgICAgICBzb3VyY2VOb2RlID0gY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgICAgICAgICBzY3JpcHROb2RlID0gY29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoNDA5NiwgMSwgMSk7XG4gICAgICAgICAgICAgICAgc2NyaXB0Tm9kZS5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUub25lbmRlZCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBzb3VyY2VOb2RlLmNvbm5lY3Qoc2NyaXB0Tm9kZSk7XG4gICAgICAgICAgICAgICAgc2NyaXB0Tm9kZS5jb25uZWN0KGdhaW5Ob2RlKTtcbiAgICAgICAgICAgICAgICBzb3VyY2VOb2RlLmNvbm5lY3QoZ2Fpbk5vZGUpO1xuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUuYnVmZmVyID0gX2J1ZmZlcjsgLy90aGlzIGVhdHMgYSBsb3Qgb2YgZnVja2luZyBtZW1vcnkgOyhcblxuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUuc3RhcnQoMCwgcmV3aW5kX3Bvcyk7XG4gICAgICAgICAgICAgICAgdmFyIHByb2dyZXNzID0gcmV3aW5kX3BvcyAvIF9idWZmZXIuZHVyYXRpb24gKiAxMDA7XG5cbiAgICAgICAgICAgICAgICBzb3VyY2VOb2RlLm9uZW5kZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChNYXRoLmNlaWwoX3RoaXMucGxfcG9zKSA+PSBNYXRoLmNlaWwoc291cmNlTm9kZS5idWZmZXIuZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXdpbmRfcG9zID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZU5vZGUuZGlzY29ubmVjdChzY3JpcHROb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdE5vZGUuZGlzY29ubmVjdChnYWluTm9kZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VOb2RlLmRpc2Nvbm5lY3QoZ2Fpbk5vZGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgUGxheWxpc3Quc2V0TmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMucGxheSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGlmIChfdGhpcy5zdGF0ZSA9PSBcIjBcIikge1xuICAgICAgICAgICAgICAgICAgICBzY3JpcHROb2RlLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24gKGF1ZGlvUHJvY2Vzc2luZ0V2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3VycmVudF90aW1lID0gYXVkaW9Qcm9jZXNzaW5nRXZlbnQucGxheWJhY2tUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMucGxfcG9zID0gX3RoaXMucGxfcG9zICsgYXVkaW9Qcm9jZXNzaW5nRXZlbnQub3V0cHV0QnVmZmVyLmR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3MgPSBfdGhpcy5wbF9wb3MgLyBzb3VyY2VOb2RlLmJ1ZmZlci5kdXJhdGlvbiAqIDEwMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLnRpbWVGcm9tU3RhcnQgPSBjdXJyZW50X3RpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBUaW1lTGluZS51cGRhdGUocHJvZ3Jlc3MsIHNvdXJjZU5vZGUuYnVmZmVyLmR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJld2luZF9wb3MgPSAwO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzLmNoYW5nZVN0YXRlKFwicGxheWluZ1wiKTtcbiAgICB9O1xuXG4gICAgdGhpcy5wYXVzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXMuY2hhbmdlU3RhdGUoXCJwYXVzZWRcIik7XG4gICAgICAgIGNvbnRleHQuc3VzcGVuZCgpO1xuICAgIH07XG5cbiAgICB0aGlzLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChfdGhpcy5zdGF0ZSAhPSBcInN0b3BlZFwiICYmIHNvdXJjZU5vZGUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBfdGhpcy5jaGFuZ2VTdGF0ZShcInN0b3BlZFwiKTtcbiAgICAgICAgICAgIHNvdXJjZU5vZGUuc3RvcCgwKTtcbiAgICAgICAgICAgIGNvbnRleHQuc3VzcGVuZCgpO1xuICAgICAgICAgICAgVGltZUxpbmUucmVzZXQoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF90aGlzLnN0b3AoKTtcbiAgICAgICAgUGxheWxpc3Quc2V0TmV4dCgpO1xuICAgICAgICBfdGhpcy5wbGF5KCk7XG4gICAgfTtcblxuICAgIHRoaXMucHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXMuc3RvcCgpO1xuICAgICAgICBQbGF5bGlzdC5zZXRQcmV2KCk7XG4gICAgICAgIF90aGlzLnBsYXkoKTtcbiAgICB9O1xuXG4gICAgdGhpcy5zZXRWb2x1bWUgPSBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgICAgIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSB2b2x1bWU7XG4gICAgfTtcblxuICAgIHRoaXMucmV3aW5kVHJhY2sgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgICAgIF90aGlzLnN0b3AoKTtcbiAgICAgICAgX3RoaXMuY2hhbmdlU3RhdGUoXCJyZXdpbmRcIik7XG4gICAgICAgIF90aGlzLnBsYXkocG9zKTtcbiAgICB9O1xuXG4gICAgdGhpcy5jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uIChuZXdfc3RhdGUpIHtcbiAgICAgICAgX3RoaXMuc3RhdGUgPSBuZXdfc3RhdGU7XG5cbiAgICAgICAgdmFyIGNoYW5nZUV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KFwicGxheWVyU3RhdGVDaGFuZ2VkXCIsIHtcbiAgICAgICAgICAgIGRldGFpbDoge1xuICAgICAgICAgICAgICAgIHN0YXRlOiBfdGhpcy5zdGF0ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChjaGFuZ2VFdmVudCk7XG4gICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicGxheWVyU3RhdGVDaGFuZ2VkXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIC8vcHJldHR5IGdvb2QgdG8gbWFrZSBuZXcgY29udHJvbHMgY2xhc3MgZm9yIHRoaXNcbiAgICAgICAgdmFyIHBsYXlCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3BsYXknKTtcbiAgICAgICAgdmFyIHBhdXNlQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19wYXVzZScpO1xuICAgICAgICB2YXIgc3RvcEJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fc3RvcCcpO1xuICAgICAgICB2YXIgbmV4dEJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fbmV4dCcpO1xuICAgICAgICB2YXIgcHJldkJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fcHJldicpO1xuXG4gICAgICAgIHZhciBjb250cm9scyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJjb250cm9sc19fYnV0dG9uXCIpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRyb2xzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb250cm9sc1tpXS5jbGFzc0xpc3QucmVtb3ZlKFwiYWN0aXZlXCIpO1xuICAgICAgICAgICAgY29udHJvbHNbaV0ucmVtb3ZlQXR0cmlidXRlKFwiZGlzYWJsZWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoIChlLmRldGFpbC5zdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSBcInBsYXlpbmdcIjpcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHBsYXlCdXR0b24uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgcGxheUJ1dHRvbi5jbGFzc0xpc3QuYWRkKFwiYWN0aXZlXCIpO1xuICAgICAgICAgICAgICAgICAgICBwbGF5QnV0dG9uLnNldEF0dHJpYnV0ZShcImRpc2FibGVkXCIsIFwiZGlzYWJsZWRcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgXCJwYXVzZWRcIjpcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHBhdXNlQnV0dG9uLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgIHBhdXNlQnV0dG9uLmNsYXNzTGlzdC5hZGQoXCJhY3RpdmVcIik7XG4gICAgICAgICAgICAgICAgICAgIHBhdXNlQnV0dG9uLnNldEF0dHJpYnV0ZShcImRpc2FibGVkXCIsIFwiZGlzYWJsZWRcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgXCJzdG9wZWRcIjpcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0b3BCdXR0b24uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgc3RvcEJ1dHRvbi5jbGFzc0xpc3QuYWRkKFwiYWN0aXZlXCIpO1xuICAgICAgICAgICAgICAgICAgICBzdG9wQnV0dG9uLnNldEF0dHJpYnV0ZShcImRpc2FibGVkXCIsIFwiZGlzYWJsZWRcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9KTtcbn0oKTtcblxudmFyIFRpbWVMaW5lID0gbmV3IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgIHZhciB0aW1lX2xpbmUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudGltZS1saW5lJyk7XG4gICAgdmFyIHJld2luZF9jb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3Jld2luZCcpO1xuICAgIHZhciB0aW1lcl9taW51dGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnRpbWVyIC5taW51dGVzJyk7XG4gICAgdmFyIHRpbWVyX3NlY29uZHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudGltZXIgLnNlY29uZHMnKTtcbiAgICB2YXIgdGltZXJfbWlsaXNlY29uZHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudGltZXIgLm1pbGlzZWNvbmRzJyk7XG5cbiAgICB2YXIgZGVmYXVsdF9iYWNrZ3JvdW5kLCBlbGVtZW50X3dpZHRoO1xuXG4gICAgdGhpcy5vZmZzZXQgPSAwO1xuXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuXG4gICAgdGhpcy5yZXdpbmQgPSBmdW5jdGlvbiAocG9zKSB7XG4gICAgICAgIHRoYXQub2Zmc2V0ID0gcG9zO1xuICAgIH07XG5cbiAgICB0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHByb2dyZXNzID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgJiYgYXJndW1lbnRzWzBdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMF0gOiAwO1xuICAgICAgICB2YXIgZHVyYXRpb24gPSBhcmd1bWVudHMubGVuZ3RoID4gMSAmJiBhcmd1bWVudHNbMV0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1sxXSA6IDA7XG5cbiAgICAgICAgdmFyIHRpbWUgPSBkdXJhdGlvbiAqIHByb2dyZXNzIC8gMTAwO1xuXG4gICAgICAgIHRpbWVfbGluZS5zdHlsZVtcImJhY2tncm91bmRcIl0gPSBfdGhpczIubWFpbkdyYWRpZW50KHByb2dyZXNzKTtcblxuICAgICAgICB2YXIgbWludXRlcyA9IE1hdGguZmxvb3IodGltZSAvIDYwKTtcbiAgICAgICAgdmFyIHNlY29uZHMgPSBNYXRoLmZsb29yKHRpbWUgLSBtaW51dGVzICogNjApO1xuICAgICAgICB2YXIgbWlsaXNlY29uZHMgPSAoKHRpbWUgLSBtaW51dGVzICogNjAgLSBzZWNvbmRzKS50b0ZpeGVkKDIpICogMTAwKS50b0ZpeGVkKDApO1xuICAgICAgICBpZiAobWludXRlcyA8IDEwKSBtaW51dGVzID0gXCIwXCIgKyBtaW51dGVzO1xuICAgICAgICBpZiAoc2Vjb25kcyA8IDEwKSBzZWNvbmRzID0gXCIwXCIgKyBzZWNvbmRzO1xuICAgICAgICBpZiAobWlsaXNlY29uZHMgPCAxMCkgbWlsaXNlY29uZHMgPSBcIjBcIiArIG1pbGlzZWNvbmRzO1xuICAgICAgICB0aW1lcl9taW51dGVzLmlubmVySFRNTCA9IG1pbnV0ZXM7XG4gICAgICAgIHRpbWVyX3NlY29uZHMuaW5uZXJIVE1MID0gc2Vjb25kcztcbiAgICAgICAgdGltZXJfbWlsaXNlY29uZHMuaW5uZXJIVE1MID0gbWlsaXNlY29uZHM7XG4gICAgfTtcblxuICAgIHRoaXMucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRpbWVfbGluZS5zdHlsZVtcImJhY2tncm91bmRcIl0gPSBfdGhpczIubWFpbkdyYWRpZW50KDApO1xuXG4gICAgICAgIHRpbWVyX21pbnV0ZXMuaW5uZXJIVE1MID0gXCIwMFwiO1xuICAgICAgICB0aW1lcl9zZWNvbmRzLmlubmVySFRNTCA9IFwiMDBcIjtcbiAgICAgICAgdGltZXJfbWlsaXNlY29uZHMuaW5uZXJIVE1MID0gXCIwMFwiO1xuICAgICAgICB0aGF0LnJld2luZF9vZmZzZXQgPSAwO1xuICAgIH07XG5cbiAgICB0aW1lX2xpbmUub25tb3VzZWVudGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBlbGVtZW50X3dpZHRoID0gZ2V0Q29tcHV0ZWRTdHlsZSh0aW1lX2xpbmUpLndpZHRoO1xuICAgIH07XG5cbiAgICB0aW1lX2xpbmUub25tb3VzZW1vdmUgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgcG9zID0gZS5vZmZzZXRYIC8gcGFyc2VJbnQoZWxlbWVudF93aWR0aCkgKiAxMDA7XG4gICAgICAgIHZhciBiZyA9IF90aGlzMi5yZXdpbmRHcmFkaWVudChwb3MpO1xuICAgICAgICByZXdpbmRfY29udGFpbmVyLnN0eWxlW1wiYmFja2dyb3VuZFwiXSA9IGJnO1xuICAgIH07XG5cbiAgICB0aW1lX2xpbmUub25tb3VzZW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV3aW5kX2NvbnRhaW5lci5zdHlsZVtcImJhY2tncm91bmRcIl0gPSBcInRyYW5zcGFyZW50XCI7XG4gICAgfTtcblxuICAgIHRpbWVfbGluZS5vbmNsaWNrID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIHBvcyA9IHBhcnNlSW50KGUub2Zmc2V0WCkgLyBwYXJzZUludChlbGVtZW50X3dpZHRoKSAqIFBsYXlsaXN0LmdldEFjdGl2ZVRyYWNrKCkuZHVyYXRpb247XG4gICAgICAgIFBsYXllci5yZXdpbmRUcmFjayhwb3MpO1xuICAgIH07XG5cbiAgICAvL2p1c3QgaHR0cHM6Ly9nb28uZ2wvUUptU1I1XG5cbiAgICB0aGlzLm1haW5HcmFkaWVudCA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICAgICAgdmFyIGdyYWRpZW50ID0gXCIgbGluZWFyLWdyYWRpZW50KHRvIGJvdHRvbSxyZ2JhKDAsMCwwLDAuMzgpIDAlLHJnYmEoMCwwLDAsMC4xOCkgNDglLHJnYmEoMCwwLDAsMC4xOCkgNTMlLCByZ2JhKDAsMCwwLDAuMzgpIDEwMCUpLGxpbmVhci1ncmFkaWVudCh0byByaWdodCxyZ2JhKDAsMCwwLDAuMTgpIDAlLCByZ2JhKDAsMCwwLDAuMTgpIFwiICsgcG9zICsgXCIlLCAjZWFlYWVhIFwiICsgcG9zICsgXCIlLCAjZWFlYWVhIDEwMCUpXCI7XG4gICAgICAgIHJldHVybiBncmFkaWVudDtcbiAgICB9O1xuXG4gICAgdGhpcy5yZXdpbmRHcmFkaWVudCA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgICAgICAgdmFyIGdyYWRpZW50ID0gXCJsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQsICByZ2JhKDAsMCwwLDAuMTgpIDAlLCAgcmdiYSgwLDAsMCwwLjE4KSBcIiArIHBvcyArIFwiJSwgdHJhbnNwYXJlbnQgXCIgKyBwb3MgKyBcIiUsIHRyYW5zcGFyZW50IDEwMCUpXCI7XG4gICAgICAgIHJldHVybiBncmFkaWVudDtcbiAgICB9O1xufSgpO1xuXG52YXIgUGxheWxpc3QgPSBuZXcgZnVuY3Rpb24gKCkge1xuICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgdmFyIGJ1ZmZlciA9IHZvaWQgMDtcbiAgICB0aGlzLnBsYXlsaXN0ID0gW107XG5cbiAgICB0aGlzLmFjdGl2ZVRyYWNrSW5kZXggPSAwO1xuXG4gICAgdGhpcy5hZGRUcmFjayA9IGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICAgIHZhciB0cmFjayA9IG5ldyBUcmFjayhmaWxlKTtcbiAgICAgICAgbG9hZFNvdW5kKHRyYWNrLnRyYWNrVVJMKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRyYWNrLmJ1ZmVyID0gYnVmZmVyO1xuICAgICAgICAgICAgdHJhY2suZHVyYXRpb24gPSBidWZmZXIuZHVyYXRpb247XG5cbiAgICAgICAgICAgIF90aGlzMy5wbGF5bGlzdC5wdXNoKHRyYWNrKTtcbiAgICAgICAgICAgIGNyZWF0ZVRyYWNrSFRNTCh0cmFjayk7XG4gICAgICAgICAgICB2YXIgY2hhbmdlRXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoXCJwbGF5bGlzdFN0YXRlQ2hhbmdlZFwiLCB7XG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlOiBfdGhpczMucGxheWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGNoYW5nZUV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHRoaXMuZ2V0QWN0aXZlVHJhY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF90aGlzMy5zZXRBY3RpdmVUcmFjayhfdGhpczMucGxheWxpc3RbX3RoaXMzLmFjdGl2ZVRyYWNrSW5kZXhdKTtcbiAgICAgICAgcmV0dXJuIF90aGlzMy5wbGF5bGlzdFtfdGhpczMuYWN0aXZlVHJhY2tJbmRleF07XG4gICAgfTtcblxuICAgIHRoaXMuc2V0QWN0aXZlVHJhY2sgPSBmdW5jdGlvbiAodHJhY2spIHtcbiAgICAgICAgdmFyIGFsbFRyYWNrcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJ0cmFja1wiKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhbGxUcmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFsbFRyYWNrc1tpXS5jbGFzc0xpc3QucmVtb3ZlKFwiYWN0aXZlXCIpO1xuICAgICAgICB9XG4gICAgICAgIF90aGlzMy5hY3RpdmVUcmFja0luZGV4ID0gX3RoaXMzLnBsYXlsaXN0LmluZGV4T2YodHJhY2spO1xuICAgICAgICB2YXIgdHJhY2tVcmwgPSBfdGhpczMucGxheWxpc3RbX3RoaXMzLmFjdGl2ZVRyYWNrSW5kZXhdLnRyYWNrVVJMO1xuICAgICAgICB2YXIgdHJhY2tDb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnRyYWNrW2RhdGEtZmlsZXVybD1cXCdcIiArIHRyYWNrVXJsICsgXCJcXCddXCIpO1xuICAgICAgICB0cmFja0NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKFwiYWN0aXZlXCIpO1xuICAgIH07XG5cbiAgICB0aGlzLnNldE5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwbGF5bGlzdF9sZW5naHQgPSBfdGhpczMucGxheWxpc3QubGVuZ3RoO1xuICAgICAgICB2YXIgbmV4dCA9IF90aGlzMy5hY3RpdmVUcmFja0luZGV4ICsgMTtcbiAgICAgICAgaWYgKF90aGlzMy5hY3RpdmVUcmFja0luZGV4ICsgMSA+IHBsYXlsaXN0X2xlbmdodCAtIDEpIG5leHQgPSAwO1xuICAgICAgICBfdGhpczMuc2V0QWN0aXZlVHJhY2soX3RoaXMzLnBsYXlsaXN0W25leHRdKTtcbiAgICB9O1xuXG4gICAgdGhpcy5zZXRQcmV2ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGxheWxpc3RfbGVuZ2h0ID0gX3RoaXMzLnBsYXlsaXN0Lmxlbmd0aDtcbiAgICAgICAgdmFyIHByZXYgPSBfdGhpczMuYWN0aXZlVHJhY2tJbmRleCAtIDE7XG4gICAgICAgIGlmIChfdGhpczMuYWN0aXZlVHJhY2tJbmRleCAtIDEgPCAwICYmIHBsYXlsaXN0X2xlbmdodCAhPSAwKSBwcmV2ID0gcGxheWxpc3RfbGVuZ2h0IC0gMTtcbiAgICAgICAgaWYgKF90aGlzMy5hY3RpdmVUcmFja0luZGV4IC0gMSA8IDAgJiYgcGxheWxpc3RfbGVuZ2h0ID09IDApIHByZXYgPSAwO1xuICAgICAgICBfdGhpczMuc2V0QWN0aXZlVHJhY2soX3RoaXMzLnBsYXlsaXN0W3ByZXZdKTtcbiAgICB9O1xuXG4gICAgdGhpcy5kZWxldGVUcmFjayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy9mb3IgdGhlIGZ1dHVyZSB1c2UgKSlcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlVHJhY2tIVE1MKHRyYWNrKSB7XG4gICAgICAgIHZhciBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uO1xuICAgICAgICB2YXIgdGltZSA9IG5ldyBEYXRlKG51bGwpO1xuICAgICAgICB2YXIgbmFtZSA9IHRyYWNrLm5hbWU7XG4gICAgICAgIHZhciB1cmwgPSB0cmFjay50cmFja1VSTDtcbiAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgdmFyIHBsYXlsaXN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5wbGF5bGlzdF9fdHJhY2tzXCIpO1xuXG4gICAgICAgIHRpbWUuc2V0U2Vjb25kcyhkdXJhdGlvbik7XG5cbiAgICAgICAgZHVyYXRpb24gPSB0aW1lLmdldE1pbnV0ZXMoKSArIFwiOlwiICsgdGltZS5nZXRTZWNvbmRzKCk7XG5cbiAgICAgICAgY29udGFpbmVyLmNsYXNzTmFtZSA9ICdwbGF5bGlzdF9faXRlbSB0cmFjayc7XG4gICAgICAgIGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2RhdGEtZmlsZVVybCcsIHVybCk7XG5cbiAgICAgICAgdmFyIHRyYWNrX19uYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXG4gICAgICAgIHRyYWNrX19uYW1lLmNsYXNzTmFtZSA9ICd0cmFja19fbmFtZSc7XG4gICAgICAgIHRyYWNrX19uYW1lLmlubmVySFRNTCA9IG5hbWU7XG5cbiAgICAgICAgdmFyIHRyYWNrX19kdXJhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblxuICAgICAgICB0cmFja19fZHVyYXRpb24uY2xhc3NOYW1lID0gJ3RyYWNrX19kdXJhdGlvbic7XG4gICAgICAgIHRyYWNrX19kdXJhdGlvbi5pbm5lckhUTUwgPSBkdXJhdGlvbjtcblxuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodHJhY2tfX25hbWUpO1xuICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodHJhY2tfX2R1cmF0aW9uKTtcblxuICAgICAgICBwbGF5bGlzdC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuXG4gICAgICAgIGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIFBsYXlsaXN0LnNldEFjdGl2ZVRyYWNrKHRyYWNrKTtcbiAgICAgICAgICAgIGlmIChQbGF5ZXIuc3RhdGUgPT0gXCJwbGF5aW5nXCIgfHwgUGxheWVyLnN0YXRlID09IFwicGF1c2VkXCIpIFBsYXllci5zdG9wKCk7XG4gICAgICAgICAgICBQbGF5ZXIucGxheSgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkZWxldGVUcmFja0hUTUwoKSB7XG4gICAgICAgIC8vZm9yIGZ1dHVyZSB1c2VcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkU291bmQodXJsKSB7XG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgLy90aGlzIGxvYWRzIGFzeW5jaHJvbm91c2x5XG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgcmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcblxuICAgICAgICAgICAgLy9hc3luY2hyb25vdXMgY2FsbGJhY2tcbiAgICAgICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdsb2FkIGZpbmlzaGVkJyk7XG4gICAgICAgICAgICAgICAgdmFyIGF1ZGlvRGF0YSA9IHJlcXVlc3QucmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgLy9hbm90aGVyIGFzeW5jXG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWNvZGVBdWRpb0RhdGEoYXVkaW9EYXRhKS50aGVuKGZ1bmN0aW9uIChkZWNvZGVkRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGJ1ZmZlciA9IGRlY29kZWREYXRhKTtcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZGVjb2RpbmcgZXJyb3JcIik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXF1ZXN0LnNlbmQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwbGF5bGlzdFN0YXRlQ2hhbmdlZFwiLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICBpZiAoZS5kZXRhaWwuc3RhdGUgIT0gMCkge1xuICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5wbGF5ZXJfX2NvbnRyb2xzXCIpLmNsYXNzTGlzdC5yZW1vdmUoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWVyX19jb250cm9sc1wiKS5jbGFzc0xpc3QuYWRkKFwiZGlzYWJsZWRcIik7XG4gICAgICAgIH1cbiAgICB9KTtcbn0oKTtcblxudmFyIFRyYWNrID0gZnVuY3Rpb24gVHJhY2soZmlsZSkge1xuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGZpbGUpO1xuXG4gICAgdGhpcy5kdXJhdGlvbiA9IDA7XG5cbiAgICB0aGlzLnRyYWNrVVJMID0gdXJsO1xuXG4gICAgdGhpcy5uYW1lID0gZmlsZS5uYW1lLnN1YnN0cmluZygwLCBmaWxlLm5hbWUubGVuZ3RoIC0gNCk7XG5cbiAgICB0aGlzLmJ1ZmVyID0gbnVsbDtcblxuICAgIHRoaXMuY29udGFpbmVyID0gbnVsbDtcbn07XG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLWNvbnRyb2xzLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0vL1xuXG52YXIgcGxheUJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fcGxheScpO1xudmFyIHBhdXNlQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19wYXVzZScpO1xudmFyIHN0b3BCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udHJvbHNfX3N0b3AnKTtcbnZhciBuZXh0QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzX19uZXh0Jyk7XG52YXIgcHJldkJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250cm9sc19fcHJldicpO1xuXG52YXIgdm9sdW1lY29udHJvbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY29udHJvbHNfX3ZvbHVtZVwiKTtcblxudm9sdW1lY29udHJvbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgUGxheWVyLnNldFZvbHVtZSh2b2x1bWVjb250cm9sLnZhbHVlIC8gMTAwKTtcbn0pO1xuXG5wbGF5QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgUGxheWVyLnBsYXkpO1xucGF1c2VCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBQbGF5ZXIucGF1c2UpO1xuc3RvcEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIFBsYXllci5zdG9wKTtcbm5leHRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBQbGF5ZXIubmV4dCk7XG5wcmV2QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgUGxheWVyLnByZXYpO1xuXG52YXIgZmlsZV9pbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWxlJyk7XG5cbmZpbGVfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBmdW5jdGlvbiAoZSkge1xuICAgIGNvbnNvbGUubG9nKCdhc2Rhc2RzYWQnLCBmaWxlX2lucHV0LmZpbGVzKTtcbiAgICB2YXIgZmlsZSA9IGZpbGVfaW5wdXQuZmlsZXNbMF07XG4gICAgaWYgKGZpbGVDaGVjayhmaWxlKSkge1xuICAgICAgICBQbGF5bGlzdC5hZGRUcmFjayhmaWxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhbGVydChcImFsbG93ZWQgb25seSBNUDMsIFdBViBhbmQgT0dHIGZpbGVzIGxlc3MgdGhhbiAxNU1iXCIpO1xuICAgIH1cblxuICAgIGUucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG5mdW5jdGlvbiBmaWxlQ2hlY2soZmlsZSkge1xuICAgIHZhciByZXN1bHQgPSBmYWxzZTtcbiAgICBpZiAoZmlsZS5zaXplIDwgMTU3Mjg2NDApIHtcbiAgICAgICAgdmFyIHBhcnRzID0gZmlsZS5uYW1lLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgdmFyIGV4dCA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgbWltZVR5cGUgPSBmaWxlLnR5cGU7XG4gICAgICAgIHZhciBhbGxvd2VkRXh0ID0gW1wibXAzXCIsIFwib2dnXCIsIFwid2F2XCJdO1xuICAgICAgICB2YXIgYWxsb3dlZE1JTUUgPSBbXCJhdWRpby9tcGVnXCIsIFwiYXVkaW8vb2dnXCIsIFwiYXVkaW8vd2F2XCJdO1xuICAgICAgICBpZiAoYWxsb3dlZEV4dC5pbmNsdWRlcyhleHQudG9Mb3dlckNhc2UoKSkgfHwgYWxsb3dlZE1JTUUuaW5jbHVkZXMobWltZVR5cGUudG9Mb3dlckNhc2UoKSkpIHJlc3VsdCA9IHRydWU7XG5cbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PSAxKSByZXN1bHQgPSB0cnVlOyAvL2EgaG9sZSBmb3IgbW9iaWxlXG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59Il0sImZpbGUiOiJtYWluLmpzIn0=
