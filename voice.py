# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE.md file in the project root for full license information.

# <code>
import azure.cognitiveservices.speech as speechsdk
from flask import Flask, render_template, request
from chatterbot import ChatBot
from chatterbot.trainers import ChatterBotCorpusTrainer
from chatterbot.response_selection import get_random_response

app = Flask(__name__)


my_bot = ChatBot(name='コンシェルジュ０号', read_only=True,
                 response_selection_method=get_random_response,
                 logic_adapters=[{
                     'import_path': 'chatterbot.logic.SpecificResponseAdapter',
                     'input_text': 'empty',
                     'output_text': ''
                 },
                     {
                         'import_path': 'chatterbot.logic.BestMatch',
                         'default_response': 'よくわかりません。もう一度入力してください。',
                         'maximum_similarity_threshold': 0.7
                     },
                     {
                         'import_path': 'chatterbot.logic.MathematicalEvaluation'
                     }]
                 )
'''
corpus_trainer = ChatterBotCorpusTrainer(my_bot)
corpus_trainer.train("./data/my_corpus/conversations.yml")

# print(my_bot.name, "：ご要望は何ですか？")


'''

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/get")
def get_bot_response():
    user_input = request.args.get('msg')
    return my_bot.name + "：" + str(my_bot.get_response(user_input))


@app.route("/voice")
def get_voice_response():
    # Creates an instance of a speech config with specified subscription key and service region.
    # Replace with your own subscription key and service region (e.g., "westus").
    speech_key, service_region = "cf7ce1c0351b479a884e23e1a64665a9", "japanwest"
    speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=service_region)
    speech_config.speech_recognition_language = "ja-JP"

    # Creates a recognizer with the given settings
    speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config)

    print("Say something...")

    # Starts speech recognition, and returns after a single utterance is recognized. The end of a
    # single utterance is determined by listening for silence at the end or until a maximum of 15
    # seconds of audio is processed.  The task returns the recognition text as result.
    # Note: Since recognize_once() returns only a single utterance, it is suitable only for single
    # shot recognition like command or query.
    # For long-running multi-utterance recognition, use start_continuous_recognition() instead.
    result = speech_recognizer.recognize_once()

    # Checks result.
    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        print("Recognized: {}".format(result.text))
    elif result.reason == speechsdk.ResultReason.NoMatch:
        print("No speech could be recognized: {}".format(result.no_match_details))
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation_details = result.cancellation_details
        print("Speech Recognition canceled: {}".format(cancellation_details.reason))
        if cancellation_details.reason == speechsdk.CancellationReason.Error:
            print("Error details: {}".format(cancellation_details.error_details))

    # </code>

    #return my_bot.name + "：" + str(my_bot.get_response(user_input))


if __name__ == "__main__":
    # httpserver = WSGIServer(('0.0.0.0', 5000), app)
    # httpserver.serve_forever()
    app.run(host='192.168.43.141', port=80)
    #app.run(host='127.0.0.1', port=8080)
