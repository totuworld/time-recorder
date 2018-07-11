[![Build Status](https://travis-ci.org/totuworld/time-recorder.svg?branch=master)](https://travis-ci.org/totuworld/time-recorder)

# Time Recorder

Time Recorder는 firebase를 활용해서 작업 시간을 기록하기 위해서 만들어진 slack app용 백엔드 functions의 모음이다.

## 제작 이유

대한민국에서 2018년 7월 1일부터 300인 이상 사업장은 주 40시간 근무(최대 52시간)가 시행되었다. 이에 따라 개인의 업무를 간단하게 기록할 방법을 찾다가 만들게 되었다.

## 설치 방법

* firebase 계정을 등록
* firebase cli를 설치하고, functions를 init한다.
    npm install -g firebase
    firebase init
* TypeScript로 생성된 프로젝트에 functions 폴더에 들어있는 파일들을 적용
* package.json 내용도 반영
* `slack app`을 생성하고 *slash commands*와 *Interactive Components* 를 각각 설정한다.
  * slash commands: https://function_host/command_ping
  * interative components: https://function_host/message_action

## TODO

- [x] 출/퇴근 기록
- [x] 휴식 및 긴급 대응 기록
- [ ] 당일(today), 주간, 특정일(yyyyMMdd) 로그 조회
- [ ] 조징장 및 개인에게 8시간 이상 근무시 slack notification 발송 기능

## 참고 링크

* https://medium.com/evenbit/building-a-slack-app-with-firebase-as-a-backend-151c1c98641d