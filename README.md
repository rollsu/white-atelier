# 화이트 아틀리에

빌드 과정이 없는 정적 사이트입니다. 폴더 그대로 Vercel에 올리면 됩니다.

## 구조

```
index.html        화면 뼈대 (아래 파일들을 순서대로 불러온다)
css/base.css      기본 스타일
css/style.css     전체 디자인 (테마·카드·버튼·오버레이)
js/engine.js      게임 엔진 기초
js/data.js        재료·물약·지역 데이터
js/ext1.js        재료 300종·자유 조합·물건 제작·중앙 마을
js/ext2.js        마나·능력 5종·특수 스킬
js/ext3.js        이동 시간·빗자루·마을 레벨
js/ext4.js        날씨·계절
js/ext5.js        별나루 회관: 의뢰 게시판·마을 업그레이드
js/ext6.js        세계수 단서·창고·피로·임대료
js/ext7.js        챕터·세계수 묘목·업적·채집 사건
js/ext8.js        재료 5등급 재조정·만든 조합 기억
js/ui.js          화면(UI)·소리·저장
js/firebase-config.js  Firebase 설정값 (채팅·로그인을 켜려면 여기에 붙여 넣기)
js/chat.js        로그인(Google·이메일·게스트) · 이름 정하기 · 전체 채팅
database.rules.json  Firebase 보안 규칙
```

**js 파일은 순서가 중요합니다.** 위에서 아래 순서로 불러오며, 앞 파일의 클래스를 뒤 파일이 이어받습니다. `index.html`의 `<script>` 순서를 바꾸지 마세요.

## Vercel 배포

1. 이 폴더를 GitHub 저장소로 올린다.
2. vercel.com > Add New > Project > 저장소 Import.
3. Framework Preset: **Other**, Build Command와 Output Directory는 비워 두고 Deploy.

이후 파일을 고쳐 push하면 자동으로 다시 배포됩니다.

로컬에서 보려면 `index.html`을 브라우저로 열면 됩니다.

## 저장

진행 기록은 브라우저 localStorage에 저장되므로 주소(도메인)가 바뀌면 기록이 따로 생깁니다. 주소를 바꾸기 전에 설정의 "내보내기"로 저장 파일을 받아 두세요.

## 채팅 · 로그인 켜기 (Firebase, 무료 Spark 플랜)

설정값을 넣기 전에는 채팅 칸에 안내만 나오고, 게임은 그대로 동작합니다.

1. [console.firebase.google.com](https://console.firebase.google.com) > 프로젝트 추가.
2. **빌드 > Authentication > 시작하기 > Sign-in method**에서 켤 방식을 사용 설정:
   Google, 이메일/비밀번호, 익명(게스트).
3. **Authentication > 설정 > 승인된 도메인**에 배포 주소(`프로젝트.vercel.app`)를 추가. (`localhost`는 기본 포함)
4. **빌드 > Realtime Database > 데이터베이스 만들기**. 만든 뒤 **규칙** 탭에 `database.rules.json` 내용을 붙여 넣고 게시.
5. **프로젝트 설정 > 내 앱 > 웹 앱(</>) 추가** 후 나오는 설정값을 `js/firebase-config.js`에 붙여 넣기. `databaseURL`이 빠져 있으면 Realtime Database 화면 위쪽의 주소를 직접 넣는다.
6. 다시 배포(push).

동작: 로그인(Google · 이메일 · 게스트) → 이름 정하기(한글·영문·숫자·`_` 2~12자, 대소문자 구분 없이 중복 불가, 나중에 바꿀 수 있음) → 전체 채팅(최근 60개, 한 번에 200자, 1초에 1개). 규칙이 서버 쪽에서 이름 도용·남의 이름으로 보내기·긴 글을 막습니다. 게스트는 브라우저를 지우면 계정을 잃습니다.

참고: 이 채팅은 로그인한 사람만 읽고 쓸 수 있고, 욕설 필터·신고·차단 기능은 아직 없습니다.