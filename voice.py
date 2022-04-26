# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE.md file in the project root for full license information.

# <code>
import os

import azure.cognitiveservices.speech as speech_sdk
from flask import Flask, render_template, request, jsonify, Response, json, send_from_directory
from chatterbot import ChatBot
from chatterbot.trainers import ChatterBotCorpusTrainer
from chatterbot.response_selection import get_random_response

app = Flask(__name__)

my_bot = ChatBot(name='溶接チャートボット',
                 read_only=True,
                 excluded_words=['Q:'],
                 response_selection_method=get_random_response,
                 statement_comparison_function=LevenshteinDistance,
                 logic_adapters=[
                     {
                         'import_path': 'chatterbot.logic.SpecificResponseAdapter',
                         'input_text': 'empty',
                         'output_text': ''
                     },
                     {
                         'import_path': 'chatterbot.logic.BestMatch',
                         'default_response': 'よくわかりません。もう一度入力してください。',
                         'maximum_similarity_threshold': 0.9
                     }
                 ]
                 )
''' 学習処理
corpus_trainer = ChatterBotCorpusTrainer(my_bot)
corpus_trainer.train("./data/my_corpus/conversations.yml")
'''

# Azure Portal で取得したキーと地域を指定 --- (*1)
API_KEY = "cf7ce1c0351b479a884e23e1a64665a9"
API_REGION = "japanwest"


def get_voice_response(audio_file):
    """
    # Creates an instance of a speech config with specified subscription key and service region.
    # Replace with your own subscription key and service region (e.g., "westus").
    speech_key, service_region = "cf7ce1c0351b479a884e23e1a64665a9", "japanwest"
    speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=service_region)
    speech_config.speech_recognition_language = "ja-JP"
    speechsdk.AudioConfig(use_default_microphone=False, filename="./data/my_voice/VoiceMemo.wav")
    # speechsdk.AudioConfig()

    # Creates a recognizer with the given settings
    speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config)

    # Starts speech recognition, and returns after a single utterance is recognized. The end of a
    # single utterance is determined by listening for silence at the end or until a maximum of 15
    # seconds of audio is processed.  The task returns the recognition text as result.
    # Note: Since recognize_once() returns only a single utterance, it is suitable only for single
    # shot recognition like command or query.
    # For long-running multi-utterance recognition, use start_continuous_recognition() instead.
    result = speech_recognizer.recognize_once()

    # Checks result.
    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        voice_str = result.text
        print("Recognized: {}".format(result.text))
    elif result.reason == speechsdk.ResultReason.NoMatch:
        voice_str = "No speech could be recognized: {}".format(result.no_match_details)
        print(voice_str)
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        voice_str = "Speech Recognition canceled: {}".format(cancellation_details.reason)
        print(voice_str)
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            voice_str = "Error details: {}".format(cancellation_details.error_details)
            print(voice_str)
    """
    # APIの設定 --- (*2)
    speech_config = speech_sdk.SpeechConfig(
        subscription=API_KEY,
        region=API_REGION)
    # 言語を日本語に指定
    speech_config.speech_recognition_language = "ja-JP"
    # WAVファイルを指定
    audio_config = speech_sdk.AudioConfig(filename="./data/my_voice/voice.wav")
    # SpeechRecognizerを生成 --- (*3)
    speech_recognizer = speech_sdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config)
    # 音声認識を実行 --- (*6)
    result = speech_recognizer.recognize_once()
    # 結果をチェック --- (*7)
    if result.reason == speech_sdk.ResultReason.RecognizedSpeech:
        voice_str = result.text
        print("Recognized: {}".format(result.text))
    elif result.reason == speech_sdk.ResultReason.NoMatch:
        voice_str = "【認識できません。もう一度試してください。】"
        print("No speech could be recognized: {}".format(result.no_match_details))
    elif result.reason == speech_sdk.ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        voice_str = "【認識中断】"
        print("Speech Recognition canceled: {}".format(cancellation_details.reason))
        if cancellation_details.reason == speech_sdk.CancellationReason.Error:
            voice_str = "【認識エラー】"
            print("Error details: {}".format(cancellation_details.error_details))
    # voice_str = result.text

    return voice_str


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/get")
def get_bot_response():
    user_input = request.args.get('msg')
    return my_bot.name + "：" + str(my_bot.get_response(user_input))


@app.route("/receive", methods=['POST'])
def form():
    files = request.files
    file = files.get('file')
    # file.save("file.wav")
    file.save("./data/my_voice/voice.wav")

    response = jsonify("File received and saved!")
    # response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers['Access-Control-Allow-Origin'] = '*'

    print("File received and saved!")
    # get_voice_response(file.filename)

    voice_text = get_voice_response(file.filename)
    print(voice_text)
    # text_recog = my_bot.get_response(result1)

    # print(text_recog)

    return jsonify(voice_text)
    # return response


@app.route('/favicon.ico')  #
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')


if __name__ == "__main__":
    # httpserver = WSGIServer(('0.0.0.0', 5000), app)
    # httpserver.serve_forever()
    # app.run(host='192.168.43.141', port=5000, ssl_context='adhoc', debug=True)
    # app.run(debug=True)
    app.run()
