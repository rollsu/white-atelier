// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹 앱)에 나오는 설정값을 아래에 붙여 넣는다.
// null 이면 채팅과 로그인이 꺼지고, 게임은 그대로 동작한다. (자세한 순서는 README.md)
// 이 값은 비밀번호가 아니라 공개되어도 되는 식별 정보다. 보안은 database.rules.json 규칙이 맡는다.
window.FIREBASE_CONFIG = null;

/* 붙여 넣는 모양 예시
window.FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: '프로젝트id.firebaseapp.com',
  databaseURL: 'https://프로젝트id-default-rtdb.firebaseio.com',
  projectId: '프로젝트id',
  appId: '...'
};
*/
