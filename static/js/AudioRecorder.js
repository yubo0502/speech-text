// Based on Muaz Khan's RecordRTC Repository
//
// https://github.com/muaz-khan/RecordRTC
//
// www.MuazKhan.com

const Storage = {};
window.webkitAudioContext = null;
const AudioContext = window.AudioContext || window.webkitAudioContext;
const recorder = new AudioRecorder();

const startButton = document.getElementById('btn-start-recording');
const stopButton = document.getElementById('btn-stop-recording');

startButton.onclick = recorder.start;
stopButton.onclick = recorder.stop;

//Storage.ctx.createJavaScriptNode = null;

function AudioRecorder(config) {

    //config.checkForInactiveTracks = null;
    //config.onAudioProcessStarted = null;
    //config.initCallback = null;
    //config.disableLogs = null;
    config = config || {};

    const self = this;
    let mediaStream;
    let audioInput;
    let jsAudioNode;
    const bufferSize = config.bufferSize || 4096;
    const sampleRate = config.sampleRate || 44100;
    const numberOfAudioChannels = config.numberOfAudioChannels || 2;
    let leftChannel = [];
    let rightChannel = [];
    let recording = false;
    let recordingLength = 0;
    let isPaused = false;
    let isAudioProcessStarted = false;

    this.start = function () {
        setupStorage();

        navigator.mediaDevices
            .getUserMedia({audio: true})
            .then(onMicrophoneCaptured)
            .catch(onMicrophoneCaptureError);
    };

    this.stop = function () {
        stopRecording(function (blob) {
            startButton.disabled = false;
            stopButton.disabled = true;
        });

        mediaStream.getTracks().forEach(function (track) {
            track.stop();
        });

    };

    /**
     * Destroy RecordRTC instance. Clear all recorders and objects.
     * @method
     * @memberof RecordRTCPromisesHandler
     * @example
     * recorder.destroy().then(successCB).catch(errorCB);
     */


    function stopRecording(callback) {

        // stop recording
        recording = false;

        // to make sure onaudioprocess stops firing
        audioInput.disconnect();
        jsAudioNode.disconnect();


        mergeLeftRightBuffers({
            sampleRate: sampleRate,
            numberOfAudioChannels: numberOfAudioChannels,
            internalInterleavedLength: recordingLength,
            leftBuffers: leftChannel,
            rightBuffers: numberOfAudioChannels === 1 ? [] : rightChannel
        }, function (buffer, view) {

            self.blob = new Blob([view], {
                type: 'audio/wav'
            });

            self.buffer = new ArrayBuffer(view.buffer.byteLength);
            self.view = view;
            self.sampleRate = sampleRate;
            self.bufferSize = bufferSize;
            self.length = recordingLength;

            callback && callback(self.blob);

            clearRecordedData();

            isAudioProcessStarted = false;

            const data = new FormData();
            data.append('file', self.blob, 'file.wav')


            fetch('http://127.0.0.1:5000/receive', {
                //fetch('https://192.168.43.141:5000/receive', {
                method: 'POST',
                body: data,
            })

            .then((response) => {
                return response.json()　//ここでBodyからJSONを返す
            })
            .then((result) => {
                console.log(result);  //取得したJSONデータを関数に渡す
                $('#textInput').val(result);

            })
            .catch((e) => {
                console.log(e)  //エラーをキャッチし表示
            })

        });
    }

    function clearRecordedData() {
        leftChannel = [];
        rightChannel = [];
        recordingLength = 0;
        isAudioProcessStarted = false;
        recording = false;
        isPaused = false;

    }

    function setupStorage() {
        Storage.ctx = new AudioContext();

        if (Storage.ctx.createJavaScriptNode) {
            jsAudioNode = Storage.ctx.createJavaScriptNode(bufferSize, numberOfAudioChannels, numberOfAudioChannels);
        } else if (Storage.ctx.createScriptProcessor) {
            jsAudioNode = Storage.ctx.createScriptProcessor(bufferSize, numberOfAudioChannels, numberOfAudioChannels);
        } else {
            throw 'WebAudio API has no support on this browser.';
        }

        jsAudioNode.connect(Storage.ctx.destination);
    }

    function onMicrophoneCaptured(microphone) {
        startButton.disabled = true;
        stopButton.disabled = false;

        mediaStream = microphone;

        audioInput = Storage.ctx.createMediaStreamSource(microphone);
        audioInput.connect(jsAudioNode);

        jsAudioNode.onaudioprocess = onAudioProcess;

        recording = true;
    }


    function onMicrophoneCaptureError() {
        console.log("There was an error accessing the microphone. You may need to allow the browser access");
    }

    function onAudioProcess(e) {

        if (isPaused) {
            return;
        }

        if (isMediaStreamActive() === false) {
            if (!config.disableLogs) {
                console.log('MediaStream seems stopped.');
            }
        }

        if (!recording) {
            return;
        }

        if (!isAudioProcessStarted) {
            isAudioProcessStarted = true;
            if (config.onAudioProcessStarted) {
                config.onAudioProcessStarted();
            }

            if (config.initCallback) {
                config.initCallback();
            }
        }

        const left = e.inputBuffer.getChannelData(0);

        // we clone the samples
        leftChannel.push(new Float32Array(left));

        if (numberOfAudioChannels === 2) {
            const right = e.inputBuffer.getChannelData(1);
            rightChannel.push(new Float32Array(right));
        }

        recordingLength += bufferSize;

        // export raw PCM
        self.recordingLength = recordingLength;
    }

    function isMediaStreamActive() {
        if (config.checkForInactiveTracks === false) {
            // always return "true"
            return true;
        }

        if ('active' in mediaStream) {
            if (!mediaStream.active) {
                return false;
            }
        } else if ('ended' in mediaStream) { // old hack
            if (mediaStream.ended) {
                return false;
            }
        }
        return true;
    }

    function mergeLeftRightBuffers(config, callback) {
        function mergeAudioBuffers(config, cb) {
            config.desiredSampRate = null;
            const numberOfAudioChannels = config.numberOfAudioChannels;

            // todo: "slice(0)" --- is it causes loop? Should be removed?
            let leftBuffers = config.leftBuffers.slice(0);
            let rightBuffers = config.rightBuffers.slice(0);
            let sampleRate = config.sampleRate;
            const internalInterleavedLength = config.internalInterleavedLength;
            const desiredSampRate = config.desiredSampRate;

            if (numberOfAudioChannels === 2) {
                leftBuffers = mergeBuffers(leftBuffers, internalInterleavedLength);
                rightBuffers = mergeBuffers(rightBuffers, internalInterleavedLength);
                if (desiredSampRate) {
                    leftBuffers = interpolateArray(leftBuffers, desiredSampRate, sampleRate);
                    rightBuffers = interpolateArray(rightBuffers, desiredSampRate, sampleRate);
                }
            }

            if (numberOfAudioChannels === 1) {
                leftBuffers = mergeBuffers(leftBuffers, internalInterleavedLength);
                if (desiredSampRate) {
                    leftBuffers = interpolateArray(leftBuffers, desiredSampRate, sampleRate);
                }
            }

            // set sample rate as desired sample rate
            if (desiredSampRate) {
                sampleRate = desiredSampRate;
            }

            // for changing the sampling rate, reference:
            // http://stackoverflow.com/a/28977136/552182
            function interpolateArray(data, newSampleRate, oldSampleRate) {
                const fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
                //var newData = new Array();
                const newData = [];
                //var springFactor = new Number((data.length - 1) / (fitCount - 1));
                const springFactor = Number((data.length - 1) / (fitCount - 1));
                newData[0] = data[0]; // for new allocation
                for (let i = 1; i < fitCount - 1; i++) {
                    const tmp = i * springFactor;
                    //var before = new Number(Math.floor(tmp)).toFixed();
                    //var after = new Number(Math.ceil(tmp)).toFixed();
                    const before = Number(Math.floor(tmp)).toFixed();
                    const after = Number(Math.ceil(tmp)).toFixed();
                    const atPoint = tmp - before;
                    newData[i] = linearInterpolate(data[before], data[after], atPoint);
                }
                newData[fitCount - 1] = data[data.length - 1]; // for new allocation
                return newData;
            }

            function linearInterpolate(before, after, atPoint) {
                return before + (after - before) * atPoint;
            }

            function mergeBuffers(channelBuffer, rLength) {
                const result = new Float64Array(rLength);
                let offset = 0;
                const lng = channelBuffer.length;

                for (let i = 0; i < lng; i++) {
                    const buffer = channelBuffer[i];
                    result.set(buffer, offset);
                    offset += buffer.length;
                }

                return result;
            }

            function interleave(leftChannel, rightChannel) {
                const length = leftChannel.length + rightChannel.length;

                const result = new Float64Array(length);

                let inputIndex = 0;

                for (let index = 0; index < length;) {
                    result[index++] = leftChannel[inputIndex];
                    result[index++] = rightChannel[inputIndex];
                    inputIndex++;
                }
                return result;
            }

            function writeUTFBytes(view, offset, string) {
                const lng = string.length;
                for (let i = 0; i < lng; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }

            // interleave both channels together
            let interleaved;

            if (numberOfAudioChannels === 2) {
                interleaved = interleave(leftBuffers, rightBuffers);
            }

            if (numberOfAudioChannels === 1) {
                interleaved = leftBuffers;
            }

            const interleavedLength = interleaved.length;

            // create wav file
            const resultingBufferLength = 44 + interleavedLength * 2;

            const buffer = new ArrayBuffer(resultingBufferLength);

            const view = new DataView(buffer);

            // RIFF chunk descriptor/identifier
            writeUTFBytes(view, 0, 'RIFF');

            // RIFF chunk length
            view.setUint32(4, 44 + interleavedLength * 2, true);

            // RIFF type
            writeUTFBytes(view, 8, 'WAVE');

            // format chunk identifier
            // FMT sub-chunk
            writeUTFBytes(view, 12, 'fmt ');

            // format chunk length
            view.setUint32(16, 16, true);

            // sample format (raw)
            view.setUint16(20, 1, true);

            // stereo (2 channels)
            view.setUint16(22, numberOfAudioChannels, true);

            // sample rate
            view.setUint32(24, sampleRate, true);

            // byte rate (sample rate * block align)
            view.setUint32(28, sampleRate * 2, true);

            // block align (channel count * bytes per sample)
            view.setUint16(32, numberOfAudioChannels * 2, true);

            // bits per sample
            view.setUint16(34, 16, true);

            // data sub-chunk
            // data chunk identifier
            writeUTFBytes(view, 36, 'data');

            // data chunk length
            view.setUint32(40, interleavedLength * 2, true);

            // write the PCM samples
            const lng = interleavedLength;
            let index = 44;
            const volume = 1;
            for (let i = 0; i < lng; i++) {
                view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
                index += 2;
            }

            if (cb) {
                return cb({
                    buffer: buffer, view: view
                });
            }

            postMessage({
                buffer: buffer, view: view
            });
        }

        const webWorker = processInWebWorker(mergeAudioBuffers);

        webWorker.onmessage = function (event) {
            callback(event.data.buffer, event.data.view);

            // release memory
            URL.revokeObjectURL(webWorker.workerURL);
        };

        webWorker.postMessage(config);
    }

    function processInWebWorker(_function) {
        const workerURL = URL.createObjectURL(new Blob([_function.toString(), ';this.onmessage =  function (e) {' + _function.name + '(e.data);}'], {
            type: 'application/javascript'
        }));

        const worker = new Worker(workerURL);
        worker.workerURL = workerURL;
        return worker;
    }
}