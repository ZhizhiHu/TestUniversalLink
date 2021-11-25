/*
 * Copyright (c) 2018. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 * Morbi non lorem porttitor neque feugiat blandit. Ut vitae ipsum eget quam lacinia accumsan.
 * Etiam sed turpis ac ipsum condimentum fringilla. Maecenas magna.
 * Proin dapibus sapien vel ante. Aliquam erat volutpat. Pellentesque sagittis ligula eget metus.
 * Vestibulum commodo. Ut rhoncus gravida arcu.
 */

var video = document.querySelector('video');
window.onload = function(){
    init();
};

function init(){
    const isSecureOrigin = location.protocol === 'https:' ||
        location.hostname === 'localhost';
    if (!isSecureOrigin) {
        alert('getUserMedia() must be run from a secure origin: HTTPS or localhost.' +
            '\n\nChanging protocol to HTTPS');
        location.protocol = 'HTTPS';
    }

    const constraints = {
        audio: true,
        video: true
    };

    //获取WebRTC
    navigator.mediaDevices.getUserMedia(constraints)
        .then(handleSuccess)
        .catch(handleError);

    function handleSuccess(stream) {
        console.log('getUserMedia() got stream: ', stream);
        window.stream = stream;
        video.srcObject = stream;

        video.onloadedmetadata = function(e) {
            console.log("Label: " + stream.label);
            console.log("AudioTracks" , stream.getAudioTracks());
            console.log("VideoTracks" , stream.getVideoTracks());
        };
    }

    function handleError(error) {
        console.log('navigator.getUserMedia error: ', error);
    }
}

async function startFace(){
    setStatusText('开始检测');
    setStatusText('开始检测,加载模型');
    await faceapi.loadFaceDetectionModel('./weights/face_detection_model-weights_manifest.json');
    modelLoaded = true;
    videoEl = $('#inputVideo').get(0);
    onPlay();
}

let minConfidence = 0.1;
let timer = null;
async function onPlay(e) {
    if(e) console.log('触发时间',e);
    if(videoEl.paused || videoEl.ended || !modelLoaded)
        return false;

    const input = await faceapi.toNetInput(videoEl);
    const { width, height } = input;
    const canvas = $('#overlay').get(0);
    canvas.width = width;
    canvas.height = height;

    const ts = Date.now();
    setStatusText('检测中');
    result = await faceapi.locateFaces(input, minConfidence);
    console.log(Date.now() - ts);
    setStatusText('检测结束，绘制中');

    faceapi.drawDetection('overlay', result.map(det => det.forSize(width, height)));
    //setTimeout(() => onPlay())
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    timer = requestAnimationFrame(onPlay);
}

function stopFace(){
    var cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
    cancelAnimationFrame(timer);
    $('#state').val('停止检测')
    document.querySelector('canvas').clear();
}

function onIncreaseThreshold() {
    minConfidence = Math.min(faceapi.round(minConfidence + 0.1), 1.0)
    $('#minConfidence').val(minConfidence)
}

function onDecreaseThreshold() {
    minConfidence = Math.max(faceapi.round(minConfidence - 0.1), 0.1)
    $('#minConfidence').val(minConfidence)
}

function snapshot() {
    if($('#inputVideo').paused){
        alert('不能截图');
        return;
    }
    var canvas = document.querySelector('#img');
    var ctx = canvas.getContext('2d');
    canvas.width = $('#inputVideo').width();
    canvas.height = $('#inputVideo').height();
    ctx.drawImage(video, 0, 0);
}

async function startDerectionByPicture(){
    setStatusText('开始检测');
    var canvas = $('#img').get(0);
    const input = await faceapi.toNetInput(canvas);

    const ts = Date.now();
    setStatusText('开始检测,加载模型');
    await faceapi.loadFaceDetectionModel('./weights/face_detection_model-weights_manifest.json');
    setStatusText('检测中', '#info');
    result = await faceapi.locateFaces(input, minConfidence);
    console.log(Date.now() - ts);
    setStatusText('检测结束, 绘制中');

    const { width, height } = input;
    faceapi.drawDetection('img', result.map(det => {
        console.log('loc', det,det.forSize(width, height));
        return det.forSize(width, height);
    }));
    setStatusText('检测结束');
}

//clip(result[0].getBox())
function clip(rect){
    var c = document.getElementById("img");
    var ctx = c.getContext("2d");
// 剪切矩形区域
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.stroke();
    ctx.clip();

    ctx.fillStyle="green";
    ctx.fillRect(0,0,150,100);
}

function downloadPicture(){
    var a = document.createElement('a');
    var t_results = document.getElementsByClassName('derection_result');
    if(t_results)
        for(let i=0; i<t_results.length; i++){
            var canvas = t_results[i];
            a.href = canvas.toDataURL('image/png'); //下载图片
            a.download = 'snapshot'+new Date()+'.png';
            //console.log(a);
            a.click();
        }
}

function setStatusText(text, id) {
    if(id) $(id).val(text);
    else $('#status').val(text);
}

function convertCanvasToImage(canvas){
    //新Image对象,可以理解为DOM;
    var image = new Image();
    //canvas.toDataURL返回的是一串Base64编码的URL,当然,浏览器自己肯定支持
    //指定格式PNG
    image.src = canvas.toDataURL("image/png");
    return image;
}

let maxDistance = 0.1;
let detectionNet, recognitionNet, landmarkNet;
let trainDescriptorsByClass = [];
async function startRecognitionByPicture() {
    await faceapi.loadModels('./weights');
    setStatusText('加载人脸库', '#info');
    trainDescriptorsByClass = await initTrainDescriptorsByClass(faceapi.recognitionNet, 1)
    console.log('trainDescriptorsByClass',trainDescriptorsByClass);

    setStatusText('开始识别', '#info');
    const inputImgEl = convertCanvasToImage(document.querySelector('#img'));
    const { width, height } = inputImgEl;
    const canvas = $('#img').get(0);
    // canvas.width = width
    // canvas.height = height


    setStatusText('人脸检测中', '#info');
    const fullFaceDescriptions = (await faceapi.allFaces(inputImgEl, minConfidence))
        .map(fd => fd.forSize(width, height));

    setStatusText('人脸识别中', '#info');
    fullFaceDescriptions.forEach(({ detection, descriptor }) => {
        console.log('fullFaceDescriptions', descriptor, detection);
        faceapi.drawDetection('img', [detection], { withScore: false });
        const bestMatch = getBestMatch(trainDescriptorsByClass, descriptor);
        const text = `${bestMatch.distance < maxDistance ? bestMatch.className : 'unkown'} (${bestMatch.distance})`;
        const { x, y, width: boxWidth, height: boxHeight } = detection.getBox();
        faceapi.drawText(
            canvas.getContext('2d'),
            x + boxWidth,
            y + boxHeight,
            text,
            Object.assign(faceapi.getDefaultDrawOptions(), { color: 'red', fontSize: 16 })
        );
    });
    setStatusText('识别结束', '#info');
}

function convertImageToCanvas(){
    var url = 'images/amy/amy1.png';
    var image = new Image();
    image.src = url;
    image.onload = function (){
        // 创建canvas DOM元素，并设置其宽高和图片一样
        var canvas = document.querySelector('#img');
        // 坐标(0,0) 表示从此处开始绘制，相当于偏移。
        canvas.getContext("2d").drawImage(image, 0, 0);
    };
}

//test(result[0].getBox())
function showDerections(){
    if(result.length<1){
        alert('无检测结果');
        return;
    }
    result
        .map(r => r.getBox())
        .forEach(function(box){
            getDerections(box)
        });
}
function getDerections(rect){
    var im = new Image();
    var canvas = document.querySelector('#img');
    im.src = canvas.toDataURL('image/png');
    im.onload = function(){
        var t_canvas = $('<canvas></canvas>')[0],
            t_ctx = t_canvas.getContext('2d');
        t_canvas.className = 'derection_result';
        t_canvas.width = rect.width;
        t_canvas.height = rect.height;
        t_ctx.drawImage(im, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
        $('#derectionResults').append(t_canvas);
    }
}