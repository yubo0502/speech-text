import sys
import time

import azure.cognitiveservices.speech as speech_sdk

# Azure Portal で取得したキーと地域を指定 --- (*1)
API_KEY = "cf7ce1c0351b479a884e23e1a64665a9"
API_REGION = "japanwest"


def recognize(file):
    # APIの設定 --- (*2)
    speech_config = speech_sdk.SpeechConfig(
        subscription=API_KEY,
        region=API_REGION)
    # 言語を日本語に指定
    speech_config.speech_recognition_language = "ja-JP"
    # WAVファイルを指定
    audio_config = speech_sdk.AudioConfig(filename=file)
    # SpeechRecognizerを生成 --- (*3)
    recog = speech_sdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config)
    # イベント管理用変数を初期化 --- (*4)
    done = False
    text = ""

    # コールバック関数を定義
    def stop_cb(evt):  # 終了した時
        nonlocal done
        done = True

    def recongnized(evt):  # 認識した時
        nonlocal text
        text += evt.result.text
        print("recognized:", evt.result)

    # 音声認識のイベント設定 --- (*5)
    recog.recognized.connect(recongnized)
    recog.session_stopped.connect(stop_cb)
    recog.canceled.connect(stop_cb)
    # 音声認識を実行 --- (*6)
    recog.start_continuous_recognition()
    # 音声認識が終わるまで待機 --- (*7)
    while not done:
        time.sleep(0.5)
    recog.stop_continuous_recognition()
    return text


# 処理を実行 --- (*8)
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("python speech-text.py (file)");
        quit()
    infile, outfile = sys.argv[1], sys.argv[1] + ".txt"
    text = recognize(infile)
    print("結果:", text)
    with open(outfile, "wt", encoding="utf-8") as fp:
        fp.write(text)
