window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioGlobalContext = new AudioContext();
var audioOutputAnalyser
var inputPoint = null,
    audioRecorder = null;
var recording = false;

// Controls the start and stop of recording
function toggleRecording( e ) {
    if (recording == true) {
        recording = false;
        audioRecorder.stop();
        audioRecorder.getBuffer( gotBuffers );
        console.log("Stop recording");
    } else {
        if (!audioRecorder)
            return;
        recording = true;
        audioRecorder.clear();
        audioRecorder.record();
        console.log("Start recording");
    }
}

function gotBuffers(buffers) {
    audioRecorder.exportWAV(doneEncoding);
}

function doneEncoding(blob) {
    document.getElementById("outputAudio").pause();
    createDownloadLink(blob);
}

function gotAudioMicrophoneStream(stream) {
    var source = audioGlobalContext.createMediaStreamSource(stream);
    source.connect(inputPoint);
}

function gotAudioOutputStream() {
    var source = audioGlobalContext.createMediaElementSource(document.getElementById("outputAudio"));
    source.connect(inputPoint);
    source.connect(audioGlobalContext.destination);
}

function initAudio() {
        if (!navigator.getUserMedia)
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!navigator.cancelAnimationFrame)
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
        if (!navigator.requestAnimationFrame)
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    inputPoint = audioGlobalContext.createGain();

    navigator.getUserMedia({
        "audio": {
            "mandatory": {
                "googEchoCancellation": "true",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "true",
                "googHighpassFilter": "false"
            },
            "optional": []
        },
    }, gotAudioMicrophoneStream, function(e) {
        alert('Error recording microphone');
        console.log(e);
    });

    gotAudioOutputStream();

    var analyserNode = audioGlobalContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect(analyserNode);
    var zeroGain = audioGlobalContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect(zeroGain);
    zeroGain.connect(audioGlobalContext.destination);

    audioRecorder = new Recorder(inputPoint);
}

window.addEventListener('load', initAudio );

function createDownloadLink(blob) {
	
	var url = URL.createObjectURL(blob);
	var au = document.createElement('audio');
	var li = document.createElement('li');
	var link = document.createElement('a');

	//name of .wav file to use during upload and download (without extendion)
	var filename = new Date().toISOString();

	//add controls to the <audio> element
	au.controls = true;
	au.src = url;

	//save to disk link
	link.href = url;
	link.download = filename+".wav"; //download forces the browser to donwload the file using the  filename
	link.innerHTML = "Save to disk";

	//add the new audio element to li
	li.appendChild(au);
	
	//add the filename to the li
	li.appendChild(document.createTextNode(filename+".wav "))

	//add the save to disk link to li
	li.appendChild(link);
	
	//upload link
	var upload = document.createElement('a');
	upload.href="#";
	upload.innerHTML = "Upload";
	upload.addEventListener("click", function(event){
		  var xhr=new XMLHttpRequest();
		  xhr.onload=function(e) {
		      if(this.readyState === 4) {
		          console.log("Server returned: ",e.target.responseText);
		      }
		  };
		  var fd=new FormData();
		  fd.append("audio_data",blob, filename);
		  xhr.open("POST","upload.php",true);
		  xhr.send(fd);
	})
	li.appendChild(document.createTextNode (" "))//add a space in between
	li.appendChild(upload)//add the upload link to li

	//add the li element to the ol
	recordingsList.appendChild(li);
}
