/*!
 * alchemy-ext7.js v10 — 챕터(이야기) · 세계수 묘목 키우기 · 업적 · 채집 사건 · NPC 개인 이야기 · 시세 변동 · 다음 목표
 * Game8 을 상속한다. 이야기 글과 수치는 이 파일 위쪽 상수에 모아 두었다.
 */
(function () {
  'use strict';
  const A = Alchemy;
  const RARS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  function F(code, message) { return { ok: false, code: code, message: message }; }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---- 세계수 묘목: 바친 자양분이 기준을 넘고, 단서도 충분히 모였을 때 한 단계씩 자란다
  const TREE = [
    { name: '씨앗', need: 0, clues: 0 },
    { name: '새싹', need: 400, clues: 0 },
    { name: '어린 묘목', need: 2000, clues: 3 },
    { name: '푸른 가지', need: 8000, clues: 6 },
    { name: '꽃핀 나무', need: 25000, clues: 9 },
    { name: '세계수', need: 70000, clues: 12 },
  ];
  const RAR_NOURISH = { common: 1, uncommon: 1.5, rare: 2, epic: 2.5, legendary: 3 };   // 재료 값에 곱하는 자양분 배수
  const POTION_NOURISH = 1.5, GOOD_NOURISH = 1;

  // ---- 챕터: 조건을 채우면 이야기가 열리고 보상을 준다
  const CHAPTERS = [
    { title: '1장 · 별이 떨어진 자리', gold: 100, hint: '별나루의 초대를 받아들인다',
      cond: (g) => g.state.introSeen,
      text: '눈을 떴을 때, 나는 낯선 마을의 입구에 서 있었다. 하늘에는 새벽별이 하나 남아 있었고, 발밑의 풀은 방금 별이 떨어진 듯 따뜻했다. 어떻게 왔는지는 아무도 묻지 않았다. 대신 회관지기 보람이 손을 내밀었다. "연금술사시군요. 마침 일손이 필요했어요."' },
    { title: '2장 · 첫 번째 솥', gold: 150, hint: '물약을 한 번 만들어 본다',
      cond: (g) => (g.state.counters.brewed || 0) >= 1 || Object.keys(g.state.discovered).length > 0,
      text: '솥 속의 물이 은빛으로 가라앉고, 처음으로 손끝에서 작은 빛이 일었다. 약초 할멈 솔이가 어깨 너머로 들여다보더니 고개를 끄덕였다. "손이 기억하고 있구나. 어디서 배웠는지는 몰라도, 이 마을에는 그런 손이 필요하단다."' },
    { title: '3장 · 마을의 온기', gold: 400, hint: '마을 레벨 2에 오른다',
      cond: (g) => g.state.townLv >= 2,
      text: '회관 지붕의 구멍이 메워지고 거래소 처마에 등이 하나 더 걸렸다. 사람들은 이제 길에서 마주치면 먼저 인사를 건넨다. 대장장이 강쇠가 투덜거렸다. "일이 늘었잖아. …고맙다는 소리다, 알아들어."' },
    { title: '4장 · 뿌리가 가리키는 곳', gold: 600, hint: '세계수의 단서를 3개 모은다',
      cond: (g) => g.state.clues.length >= 3,
      text: '흩어져 있던 이야기들이 한 방향을 가리키기 시작했다. 고요한 숲의 뿌리도, 옛 항로의 기록도, 모두 바다 너머를. 세계수는 전설이 아니라 어딘가에 실제로 서 있는 나무다. 그리고 이 마을은 그 나무의 이름을 물려받았다.' },
    { title: '5장 · 다섯 땅의 바람', gold: 900, hint: '다섯 지역 이상을 가 본다',
      cond: (g) => g.regionsVisited() >= 5,
      text: '초원의 바람, 산의 냉기, 물가의 습기, 화산의 열, 동굴의 속삭임. 발이 닿은 곳마다 다른 숨결이 있었다. 하지만 어디서나 풀 한 포기 한 포기가 같은 방향으로 고개를 기울이고 있었다. 마치 무언가를 향해 인사하듯이.' },
    { title: '6장 · 작은 묘목', gold: 1500, hint: '세계수 묘목을 \'어린 묘목\' 단계까지 키운다',
      cond: (g) => g.state.tree.stage >= 2,
      text: '회관 정원에 심은 씨앗이 어느새 무릎 높이까지 자랐다. 보람이 몰래 묘목에 물을 주다가 들켰다. "아니, 이건… 그냥 보고 있었어요. 어젯밤에 잎이 한 번 빛났거든요." 묘목은 정말로, 다녀온 곳들의 향기를 기억하고 있었다.' },
    { title: '7장 · 별이 지는 곳', gold: 2500, hint: '단서 9개를 모으고 마을 레벨 4가 된다',
      cond: (g) => g.state.clues.length >= 9 && g.state.townLv >= 4,
      text: '상인 두루가 낡은 항해 일지를 펼쳤다. "내가 이 일지를 평생 못 읽은 이유를 알겠나. 글이 아니라, 별자리였어." 일지 속 항로는 정말로 별이 지는 쪽, 바다의 가장 먼 곳에서 끝나 있었다.' },
    { title: '8장 · 열린 항로', gold: 5000, hint: '세계수의 단서를 모두 모은다',
      cond: (g) => g.state.clues.length >= 12,
      text: '열두 개의 이야기가 맞물리자 지도 위에 선 하나가 그어졌다. 대대륙으로 가는 길. 그러나 항로가 열렸다고 배가 저절로 가는 것은 아니다. 이제 필요한 것은 길을 걸어갈 힘, 곧 세계수의 묘목이 자라나는 일이다.' },
    { title: '종장 · 세계수', gold: 20000, hint: '세계수 묘목을 끝까지 키운다',
      cond: (g) => g.state.tree.stage >= 5,
      text: '묘목은 한 밤 사이에 마을 지붕보다 높이 솟았고, 뿌리는 바다 밑으로 길을 냈다. 아침 해가 닿자 잎마다 별빛이 맺혔다. 사람들은 말없이 올려다보았다. 보람이 속삭였다. "이제 아시겠어요? 별이 떨어진 건 우연이 아니었어요. 이 나무가, 당신을 불렀던 거예요."\n\n당신은 오래전 이 세계에 도달한 외부인이었다. 이제는 별나루의 연금술사이고, 세계수를 키워낸 사람이다. 이야기는 여기서 끝나지만, 마을의 하루는 계속된다.' },
  ];

  // ---- 업적
  const ACH = [
    { id: 'g50', name: '첫 수확', desc: '재료를 50개 모은다', gold: 80, ok: (g) => g.state.counters.gathered >= 50 },
    { id: 'g500', name: '바구니는 늘 가득', desc: '재료를 500개 모은다', gold: 400, ok: (g) => g.state.counters.gathered >= 500 },
    { id: 'g3000', name: '풀밭의 단골', desc: '재료를 3,000개 모은다', gold: 2000, ok: (g) => g.state.counters.gathered >= 3000 },
    { id: 'b10', name: '솥 앞의 수련', desc: '물약 조합에 10번 성공한다', gold: 150, ok: (g) => g.state.counters.brewed >= 10 },
    { id: 'b100', name: '끓는 점', desc: '물약 조합에 100번 성공한다', gold: 1200, ok: (g) => g.state.counters.brewed >= 100 },
    { id: 'c10', name: '손재주', desc: '물건을 10개 만든다', gold: 150, ok: (g) => g.state.counters.crafted >= 10 },
    { id: 'c100', name: '공방의 주인', desc: '물건을 100개 만든다', gold: 1200, ok: (g) => g.state.counters.crafted >= 100 },
    { id: 'l10', name: '먼 길', desc: '장기 채집을 10번 마친다', gold: 300, ok: (g) => g.state.counters.longDone >= 10 },
    { id: 'l50', name: '길 위의 연금술사', desc: '장기 채집을 50번 마친다', gold: 2000, ok: (g) => g.state.counters.longDone >= 50 },
    { id: 's5k', name: '장사 수완', desc: '거래소에서 5,000 G어치를 판다', gold: 300, ok: (g) => g.state.counters.sold >= 5000 },
    { id: 's50k', name: '큰손', desc: '거래소에서 50,000 G어치를 판다', gold: 3000, ok: (g) => g.state.counters.sold >= 50000 },
    { id: 'd10', name: '믿음직한 일꾼', desc: '납품 임무를 10건 마친다', gold: 300, ok: (g) => g.state.delivered >= 10 },
    { id: 'd50', name: '마을의 일꾼', desc: '납품 임무를 50건 마친다', gold: 2500, ok: (g) => g.state.delivered >= 50 },
    { id: 'v10', name: '새내기 연금술사', desc: '연금술사 Lv.10', gold: 300, ok: (g) => g.state.level >= 10 },
    { id: 'v30', name: '숙련 연금술사', desc: '연금술사 Lv.30', gold: 1500, ok: (g) => g.state.level >= 30 },
    { id: 'v60', name: '대가', desc: '연금술사 Lv.60', gold: 6000, ok: (g) => g.state.level >= 60 },
    { id: 't3', name: '번듯한 마을', desc: '마을 레벨 3', gold: 500, ok: (g) => g.state.townLv >= 3 },
    { id: 't5', name: '별나루의 번영', desc: '마을 레벨 5', gold: 5000, ok: (g) => g.state.townLv >= 5 },
    { id: 'k6', name: '실마리', desc: '세계수의 단서 6개', gold: 600, ok: (g) => g.state.clues.length >= 6 },
    { id: 'k12', name: '모든 길은', desc: '세계수의 단서 12개', gold: 4000, ok: (g) => g.state.clues.length >= 12 },
    { id: 'i25', name: '도감 채우기', desc: '재료 도감의 25%', gold: 400, ok: (g) => g.seenRatio() >= 0.25 },
    { id: 'i60', name: '박물학자', desc: '재료 도감의 60%', gold: 2500, ok: (g) => g.seenRatio() >= 0.6 },
    { id: 'i100', name: '모든 잎을 알다', desc: '재료 도감을 모두 채운다', gold: 10000, ok: (g) => g.seenRatio() >= 1 },
    { id: 'r15', name: '비약 수집가', desc: '이름 있는 비약을 15종 발견한다', gold: 800, ok: (g) => Object.keys(g.state.discovered).length >= 15 },
    { id: 'a-all', name: '발품', desc: '채집할 수 있는 지역을 모두 가 본다', gold: 1500, ok: (g) => g.allVisited() },
    { id: 'h10', name: '단골이 된 사이', desc: '마을 사람 한 명과 호감도 10칸을 채운다', gold: 1500, ok: (g) => Object.keys(g.state.favor).some((k) => g.state.favor[k] >= 10) },
    { id: 'e10', name: '길 위의 이야기', desc: '채집 중 사건을 10번 겪는다', gold: 600, ok: (g) => g.state.stat.events >= 10 },
    { id: 'tr3', name: '푸른 손', desc: '세계수 묘목을 \'푸른 가지\'까지 키운다', gold: 3000, ok: (g) => g.state.tree.stage >= 3 },
    { id: 'tr5', name: '세계수를 키운 사람', desc: '세계수를 완성한다', gold: 20000, ok: (g) => g.state.tree.stage >= 5 },
  ];

  // ---- NPC 개인 이야기: 호감도 2·5·8·10 칸에서 한 편씩
  const SCENE_HEARTS = [2, 5, 8, 10];
  const SCENES = {
    camp: [
      '솔이는 선반 맨 위에서 먼지 쌓인 솥 하나를 내려 보였다. "오래전에 너처럼 갑자기 나타난 연금술사가 있었단다. 이 솥을 두고 떠났지. 별이 지는 쪽으로 갔다고만 해 두자."',
      '"그 사람은 말이다, 약초를 뽑을 때마다 미안하다고 중얼거렸어. 그래서 그 사람 약은 쓰지 않고 달았지." 솔이가 차를 따라 주며 웃었다. "너도 중얼거리더구나. 알고 있었니?"',
      '솔이가 낡은 공책을 건넸다. 약초 그림 옆에 같은 필체로 이런 메모가 적혀 있었다. \'세계수의 잎은 병을 낫게 하는 게 아니라, 사람이 낫고 싶어 하는 마음을 깨운다.\' "이제 네가 이어서 적으렴."',
      '솔이는 솥을 닦아 당신 앞에 놓았다. "이건 이제 네 거야. 그 사람이 두고 간 게 아니라, 기다리고 있던 거였어. 이 솥을 쓸 사람을." 솥 바닥에는 별 모양 흠집이 하나 있었다. 당신의 손바닥과 꼭 맞았다.',
    ],
    market: [
      '두루는 장부 뒤에서 바다 그림이 그려진 부채를 꺼냈다. "나도 한때는 배를 몰았지. 대대륙까지 가 본 사람은 못 봤지만, 갈 수 있다고 믿는 사람은 많이 봤어."',
      '"내 배는 안개 속에서 항로를 잃고 가라앉았다네. 선원들은 무사했어. 그때 알았지, 재산이란 건 잃어도 사람 얼굴만 남으면 장사는 다시 한다는 걸." 두루가 껄껄 웃었다.',
      '두루가 찢어진 해도 한 장을 펼쳤다. "항로 끝에는 항상 같은 표시가 있었어. 나무 모양이야. 선원들은 그걸 \'등대\'라고 불렀지. 불을 켜는 건 사람이 아니라, 나무 자신이라고."',
      '두루는 낡은 나침반을 당신 손에 쥐여 주었다. "바늘이 뱅뱅 도는 나침반이야. 평생 고장 난 줄 알았는데, 이 마을에 와서야 알았네. 이건 북쪽이 아니라 세계수를 가리킨다는 걸."',
    ],
    tool_street: [
      '강쇠는 망치질을 멈추지 않고 말했다. "도구는 거짓말을 안 해. 손이 거칠면 낫도 거칠고, 마음이 급하면 곡괭이도 금이 간다. …너는 급한 사람은 아니더군."',
      '"아들놈이 있었다. 항로를 찾겠다고 십 년 전에 떠났지. 편지 한 장 없어." 강쇠가 불꽃을 바라보며 중얼거렸다. "그래도 매년 그 애 몫의 낫을 하나씩 만들어 둔다. 쓸데없는 짓인 줄은 알아."',
      '강쇠가 벽장에서 작은 낫을 꺼냈다. "이건 열 번째 해에 만든 거다. 처음으로 날이 안 무뎌진 낫이야. 이상하지, 아들 생각을 안 하고 만든 날에서야 제일 잘 나왔다."',
      '"이제 그 낫은 네 거다." 강쇠가 시선을 피한 채 말했다. "누군가 쓰는 도구가 제일 행복한 도구다. 아들놈이 돌아오면… 같이 풀을 베면 되겠지. 둘이서."',
    ],
    town_hall: [
      '보람은 서류 더미 속에서 고개를 들었다. "별나루는 \'별이 떨어지는 나루\'라는 뜻이에요. 오래전부터 가끔 낯선 사람이 하늘에서 내려온다는 전설이 있었죠. 설마 진짜일 줄은요."',
      '"당신이 도착한 날 밤에 회관 지하의 씨앗이 처음으로 따뜻해졌어요. 백 년 동안 차가웠던 씨앗이." 보람이 낮은 목소리로 말했다. "그래서 처음엔 무서웠어요. 지금은 감사해요."',
      '보람이 마을 기록부를 펼쳤다. 맨 마지막 장에 당신 이름이 적혀 있었다. 이름 옆에는 아직 채워지지 않은 빈 칸이 있었다. "이 칸에 뭐라고 쓸지는 당신이 정하는 거예요. 저는 그냥, 지켜볼게요."',
      '"이제 비밀을 하나 말씀드릴게요." 보람이 웃었다. "이 마을의 첫 번째 외부인도, 연금술사였어요. 그분이 심은 씨앗이 지금 지하에 있는 거고요. 당신은 그분이 남긴 마지막 문장의 답이에요. \'다음 사람이 이어 주기를.\'"',
    ],
  };
  const SCENE_GIFT = { camp: { gold: 600, herb: 'rare', n: 2 }, market: { gold: 1200, herb: 'uncommon', n: 4 },
    tool_street: { gold: 800, herb: 'rare', n: 2 }, town_hall: { gold: 1500, herb: 'rare', n: 3 } };

  // ---- 채집 사건: 장기 채집을 마치면 가끔 일어난다. 선택지에 따라 결과가 달라진다.
  //   regions: 일어날 수 있는 지역(없으면 어디서나) · bad: 나쁜 날씨일 때만 · w: 일어날 가중치
  //   choice.need = { abil, lv } 능력 조건 · choice.cost = 금화 · outcome = { w, text, gold:[a,b], herb:[등급,최소,최대], xp, abil:[키,양], clue }
  const EVENTS = [
    { id: 'traveler', title: '길 잃은 여행자', w: 3, text: '길 한가운데서 지도를 거꾸로 든 여행자가 서성이고 있다. 눈이 마주치자 반색을 하며 다가온다.',
      choices: [
        { label: '길을 알려 준다', outcomes: [
          { w: 7, text: '여행자가 고맙다며 주머니를 털어 사례했다.', gold: [40, 90] },
          { w: 3, text: '여행자가 말린 약초 꾸러미를 답례로 건넸다.', herb: ['uncommon', 1, 2] }] },
        { label: '물건을 팔아 보려 한다', outcomes: [
          { w: 5, text: '여행자가 흥미롭게 물건을 둘러보고 몇 개를 샀다.', gold: [15, 40] },
          { w: 5, text: '여행자는 어깨를 으쓱하고 떠났다.' }] },
        { label: '말동무가 되어 준다', need: { abil: 'charm', lv: 5 }, outcomes: [
          { w: 1, text: '이야기가 길어졌다. 여행자의 먼 고향 이야기가 오래 기억에 남았다.', xp: 25, abil: ['charm', 20] }] }] },
    { id: 'patch', title: '숨은 약초밭', w: 3, regions: ['grassland', 'forest', 'waters'], text: '수풀 너머로 사람 손이 닿지 않은 약초밭이 숨어 있다.',
      choices: [
        { label: '조심스럽게 캔다', outcomes: [
          { w: 7, text: '뿌리까지 상하지 않게 캐냈다.', herb: ['uncommon', 2, 3] },
          { w: 3, text: '그늘진 구석에서 귀한 한 포기를 찾았다.', herb: ['rare', 1, 1] }] },
        { label: '서둘러 한 아름 뜯는다', outcomes: [
          { w: 7, text: '손이 닿는 대로 푸짐하게 뜯었다.', herb: ['common', 4, 6] },
          { w: 3, text: '뿌리가 상해 쓸 만한 것은 몇 개뿐이었다.', herb: ['common', 1, 2] }] },
        { label: '자리를 눈여겨 둔다', need: { abil: 'acu', lv: 5 }, outcomes: [
          { w: 1, text: '자라는 방향과 흙의 상태를 수첩에 적었다.', xp: 25, abil: ['acu', 20] }] }] },
    { id: 'beast', title: '다친 짐승', w: 2, regions: ['forest', 'mountain', 'caves'], text: '덤불 속에서 다친 짐승이 낑낑거린다. 경계하는 눈이 이쪽을 바라본다.',
      choices: [
        { label: '상처를 싸매 준다', outcomes: [
          { w: 6, text: '며칠 뒤 둥지 근처에 반짝이는 것이 놓여 있었다.', herb: ['rare', 1, 1] },
          { w: 4, text: '짐승은 말없이 숲으로 돌아갔다. 마음이 가벼워졌다.', xp: 15 }] },
        { label: '먹을 것을 나눠 준다', cost: 30, outcomes: [
          { w: 1, text: '짐승이 꼬리를 흔들며 약초가 많은 곳을 알려 주었다.', herb: ['uncommon', 2, 2], xp: 10 }] },
        { label: '조용히 지나간다', outcomes: [{ w: 1, text: '발소리를 죽이고 지나쳤다.' }] }] },
    { id: 'marker', title: '이끼 낀 이정표', w: 2, text: '이끼 낀 이정표에 낡은 글자가 새겨져 있다. 닳아서 거의 읽을 수 없다.',
      choices: [
        { label: '글을 해독한다', need: { abil: 'int', lv: 5 }, outcomes: [
          { w: 8, text: '옛 연금술사가 남긴 재료 손질법이었다. 새로운 걸 배웠다.', xp: 40, abil: ['int', 25] },
          { w: 2, clue: true, text: '글자 속에 세계수의 이름이 숨어 있었다!' }] },
        { label: '탁본을 떠 간다', outcomes: [{ w: 1, text: '탁본을 거래소 학자에게 팔 수 있을 것 같다.', gold: [20, 60] }] },
        { label: '지나친다', outcomes: [{ w: 1, text: '길을 서둘렀다.' }] }] },
    { id: 'cart', title: '떠돌이 상인', w: 3, regions: ['grassland', 'mountain', 'waters'], text: '길가에 수레를 세운 떠돌이 상인이 손짓한다. 수레 안에는 정체 모를 꾸러미가 가득하다.',
      choices: [
        { label: '꾸러미를 산다 (60 G)', cost: 60, outcomes: [
          { w: 5, text: '꾸러미를 풀자 귀한 약초가 나왔다.', herb: ['rare', 1, 1] },
          { w: 5, text: '쓸 만한 약초가 가득 들어 있었다.', herb: ['uncommon', 2, 3] }] },
        { label: '흥정을 건다', need: { abil: 'charm', lv: 5 }, outcomes: [
          { w: 6, text: '흥정 끝에 약초 몇 포기를 덤으로 받았다.', herb: ['uncommon', 2, 2] },
          { w: 4, text: '상인이 웃으며 값을 쳐 주었다.', gold: [40, 80] }] },
        { label: '구경만 한다', outcomes: [{ w: 1, text: '신기한 물건들을 구경했다. 눈 호강을 했다.', xp: 5 }] }] },
    { id: 'storm', title: '험한 날씨', w: 4, bad: true, text: '날씨가 험해졌다. 근처에 비를 피할 만한 바위 그늘이 있다.',
      choices: [
        { label: '바위 밑에서 피한다', outcomes: [{ w: 1, text: '쉬는 동안 수첩을 정리했다. 재료 메모가 제법 쌓였다.', xp: 20 }] },
        { label: '그대로 더 채집한다', outcomes: [
          { w: 5, text: '궂은 날씨 덕에 평소 못 보던 풀이 눈에 띄었다.', herb: ['uncommon', 2, 3] },
          { w: 5, text: '미끄러져 짐 일부를 잃었다.', gold: [-40, -20] }] }] },
    { id: 'dew', title: '별빛 이슬', w: 1, text: '풀잎 위의 이슬이 별빛처럼 반짝인다. 이 시간에, 이 자리에서만 볼 수 있는 광경이다.',
      choices: [
        { label: '병에 담는다', outcomes: [
          { w: 8, text: '병 속에서 은은한 빛이 맴돈다.', herb: ['rare', 1, 1] },
          { w: 2, text: '이슬이 굳어 신비로운 결정이 되었다.', herb: ['legendary', 1, 1] }] },
        { label: '가만히 바라본다', outcomes: [{ w: 1, text: '마음이 맑아졌다. 무언가 이해한 것 같은 기분이다.', xp: 35, abil: ['int', 15] }] }] },
    { id: 'spirit', title: '숲의 수수께끼', w: 2, regions: ['forest', 'caves'], text: '나무뿌리 사이에서 작은 정령이 나타나 수수께끼를 낸다. "가장 작지만 숲 전체를 키우는 것은?"',
      choices: [
        { label: '"씨앗"', outcomes: [
          { w: 8, text: '정령이 흡족한 듯 빙글 돌며 귀한 것을 건넸다.', herb: ['rare', 1, 1] },
          { w: 2, text: '정령이 박수를 치며 사라졌다.', xp: 20 }] },
        { label: '"물"', outcomes: [
          { w: 5, text: '정령이 고개를 갸웃하더니 위로의 선물을 주었다.', herb: ['uncommon', 1, 1] },
          { w: 5, text: '정령이 "틀렸어" 하고 놀리며 사라졌다.' }] },
        { label: '정령에게 되묻는다', need: { abil: 'int', lv: 10 }, outcomes: [
          { w: 7, text: '정령이 놀라 눈을 크게 떴다. 오래된 지혜를 한 조각 나눠 받았다.', xp: 60, abil: ['int', 30] },
          { w: 3, clue: true, text: '정령이 속삭였다. 세계수에 대한 오래된 이야기를.' }] }] },
    { id: 'fisher', title: '물가의 낚시꾼', w: 3, regions: ['waters'], text: '물가에서 낚시꾼이 밤새 건져 올린 것을 자랑스레 보여 준다.',
      choices: [
        { label: '물풀 꾸러미를 산다 (40 G)', cost: 40, outcomes: [{ w: 1, text: '물기를 머금은 싱싱한 풀이다.', herb: ['uncommon', 3, 3] }] },
        { label: '낚시를 거든다', outcomes: [
          { w: 7, text: '함께 그물을 끌어 올렸다. 낚시꾼이 사례했다.', gold: [30, 70] },
          { w: 3, text: '그물에 약초가 같이 딸려 왔다.', herb: ['uncommon', 1, 2], gold: [10, 30] }] }] },
    { id: 'ember', title: '식은 불씨', w: 3, regions: ['volcano'], text: '식은 화산 바위 틈에서 붉은 빛이 새어 나온다. 아직 열기가 남아 있다.',
      choices: [
        { label: '조심스레 캔다', need: { abil: 'acu', lv: 5 }, outcomes: [
          { w: 7, text: '손끝 하나 데지 않고 캐냈다.', herb: ['rare', 1, 1] },
          { w: 3, text: '틈 속에서 작은 광물이 줄줄이 나왔다.', herb: ['uncommon', 2, 3] }] },
        { label: '서둘러 캔다', outcomes: [
          { w: 5, text: '순식간에 낚아챘다.', herb: ['rare', 1, 1] },
          { w: 5, text: '손에 화상을 입었다. 약값이 들었다.', gold: [-50, -30] }] },
        { label: '거리를 두고 지켜본다', outcomes: [{ w: 1, text: '불씨가 서서히 식는 모습을 보며 불의 성질을 배웠다.', xp: 15 }] }] },
    { id: 'whisper', title: '이름을 부르는 속삭임', w: 2, regions: ['caves'], text: '동굴 안쪽에서 누군가 이름을 부른다. 내 이름은 아닌데, 이상하게 익숙하다.',
      choices: [
        { label: '귀를 기울인다', need: { abil: 'int', lv: 5 }, outcomes: [
          { w: 8, text: '속삭임은 옛 연금술사들의 기록이었다.', xp: 35, abil: ['int', 20] },
          { w: 2, clue: true, text: '속삭임이 바다 너머의 나무를 이야기했다.' }] },
        { label: '귀를 막고 나간다', outcomes: [{ w: 1, text: '서둘러 동굴을 빠져나왔다.' }] }] },
    { id: 'child', title: '길 잃은 아이', w: 2, regions: ['grassland', 'forest', 'waters'], text: '마을 아이가 길가에 앉아 울고 있다. 약초 캐러 나왔다가 길을 잃은 모양이다.',
      choices: [
        { label: '마을까지 데려다 준다', outcomes: [{ w: 1, text: '아이의 부모가 눈물로 고마워하며 사례했다.', gold: [50, 80], xp: 20 }] },
        { label: '이정표를 알려 주고 보낸다', outcomes: [{ w: 1, text: '아이는 손을 흔들며 뛰어갔다.', xp: 10 }] }] },
  ];
  const EVENT_BY_ID = {};
  EVENTS.forEach((e) => { EVENT_BY_ID[e.id] = e; });
  const EVENT_CHANCE = { 30: 0.25, 60: 0.35, 120: 0.45, 180: 0.55 };

  const PRICE_SWING = 0.15;                              // 하루 시세 변동 폭(±15%)

  class Game9 extends A.Game8 {
    migrate() {
      super.migrate();
      const s = this.state, first = s.chaps === undefined;
      s.chaps = s.chaps || []; s.chapQ = s.chapQ || [];
      if (s.evt === undefined) s.evt = null;
      s.ach = s.ach || {}; s.scenes = s.scenes || {};
      s.tree = s.tree || { pts: 0, stage: 0, ending: false };
      s.stat = s.stat || { events: 0 };
      if (first) this._sweep(true);                    // 예전 저장은 이미 이룬 챕터·업적을 조용히 인정한다
      return this;
    }

    // ------------------------------------------------------------ 진행도 계산
    regionsVisited() {
      const v = this.state.visited, set = {};
      Object.keys(v).forEach((id) => { const a = this.areas[id]; if (a && a.regionId !== 'center' && !a.noGather) set[a.regionId] = true; });
      return Object.keys(set).length;
    }
    allVisited() {
      const v = this.state.visited;
      return this.areaOrder.filter((id) => !this.areas[id].noGather).every((id) => v[id]);
    }
    seenRatio() { return Object.keys(this.state.seen).length / this.herbList.length; }

    // 챕터·업적을 확인한다. silent 면 보상과 알림 없이 기록만 한다.
    _sweep(silent) {
      const s = this.state;
      let changed = true, guard = 0;
      while (changed && guard++ < 6) {
        changed = false;
        CHAPTERS.forEach((c, i) => {
          if (s.chaps.indexOf(i) >= 0 || !c.cond(this)) return;
          s.chaps.push(i); changed = true;
          if (!silent) { s.chapQ.push(i); s.gold += c.gold; this.events.push({ type: 'chapter', i: i, gold: c.gold }); }
        });
        ACH.forEach((a) => {
          if (s.ach[a.id] || !a.ok(this)) return;
          s.ach[a.id] = 1; changed = true;
          if (!silent) { s.gold += a.gold; this.events.push({ type: 'ach', id: a.id, gold: a.gold }); }
        });
      }
    }
    drainEvents() {
      this._sweep(false);
      return super.drainEvents();
    }

    chapterList() {
      const s = this.state;
      return CHAPTERS.map((c, i) => ({ i: i, title: c.title, text: c.text, gold: c.gold, hint: c.hint, reached: s.chaps.indexOf(i) >= 0 }));
    }
    chapter(i) { return CHAPTERS[i] ? { i: i, title: CHAPTERS[i].title, text: CHAPTERS[i].text, gold: CHAPTERS[i].gold } : null; }
    nextChapterQueued() { return this.state.chapQ.length ? this.state.chapQ[0] : null; }
    ackChapter() { this.state.chapQ.shift(); }
    achList() {
      const s = this.state;
      return ACH.map((a) => ({ id: a.id, name: a.name, desc: a.desc, gold: a.gold, done: !!s.ach[a.id] }));
    }

    // ------------------------------------------------------------ 세계수 묘목
    treeInfo() {
      const t = this.state.tree, nx = TREE[t.stage + 1] || null;
      return { stage: t.stage, name: TREE[t.stage].name, pts: t.pts, ending: t.ending, max: TREE.length - 1,
        next: nx ? { name: nx.name, need: nx.need, clues: nx.clues, ptsOk: t.pts >= nx.need, cluesOk: this.state.clues.length >= nx.clues } : null,
        stages: TREE.map((x, i) => ({ name: x.name, need: x.need, clues: x.clues, reached: i <= t.stage })) };
    }
    nourishValue(kind, id) {
      if (kind === 'item') { const h = this.herbs[id]; return h ? Math.max(1, Math.round(h.price * RAR_NOURISH[h.rarity])) : 0; }
      if (kind === 'potion') { const p = this.ensurePotion(id); return p ? Math.max(1, Math.round(p.price * POTION_NOURISH)) : 0; }
      if (kind === 'good') return Math.max(1, Math.round(this.goodPrice(id) * GOOD_NOURISH));
      return 0;
    }
    nourish(kind, id, n) {
      const s = this.state, st = s.tree;
      if (s.location !== 'town_hall' || s.phase === 'travel') return F('not_here', '묘목은 별나루 회관에서만 돌볼 수 있다.');
      const have = kind === 'item' ? this.herbCount(id) : kind === 'potion' ? this.potionCount(id) : (s.goods[id] || 0);
      const num = Math.min(n || 1, have);
      if (num < 1) return F('lack', '바칠 것이 없다.');
      const v = this.nourishValue(kind, id) * num;
      if (kind === 'item') { s.herbs[id] -= num; if (s.herbs[id] <= 0) delete s.herbs[id]; }
      else if (kind === 'potion') { s.potions[id] -= num; if (s.potions[id] <= 0) delete s.potions[id]; }
      else { s.goods[id] -= num; if (s.goods[id] <= 0) delete s.goods[id]; }
      st.pts += v;
      const before = st.stage;
      while (TREE[st.stage + 1] && st.pts >= TREE[st.stage + 1].need && s.clues.length >= TREE[st.stage + 1].clues) st.stage += 1;
      let msg = '묘목에 자양분 ' + v.toLocaleString('ko-KR') + '을(를) 바쳤다.';
      if (st.stage > before) {
        msg += ' 묘목이 \'' + TREE[st.stage].name + '\'(으)로 자랐다!';
        this.events.push({ type: 'tree', stage: st.stage, name: TREE[st.stage].name });
        if (st.stage >= TREE.length - 1 && !st.ending) { st.ending = true; this.events.push({ type: 'ending' }); }
      } else {
        const nx = TREE[st.stage + 1];
        if (nx && st.pts >= nx.need && s.clues.length < nx.clues) msg += ' 자양분은 충분하지만, 뿌리가 길을 아직 모른다. (단서 ' + nx.clues + '개 필요)';
      }
      return { ok: true, value: v, grew: st.stage > before, message: msg };
    }

    // ------------------------------------------------------------ NPC 개인 이야기
    sceneList(npc) {
      const hearts = this.favorHearts(npc);
      return SCENE_HEARTS.map((h, i) => ({ h: h, got: hearts >= h, text: hearts >= h ? SCENES[npc][i] : null }));
    }
    deliver(id) {
      const s = this.state;
      const m = s.missions.find((x) => x.id === id);
      const r = super.deliver(id);
      if (!r.ok || !m || !m.npc || m.npc === 'board' || !SCENES[m.npc]) return r;
      const hearts = this.favorHearts(m.npc);
      SCENE_HEARTS.forEach((h, i) => {
        const key = m.npc + h;
        if (hearts < h || s.scenes[key]) return;
        s.scenes[key] = true;
        const ev = { type: 'scene', npc: m.npc, h: h, text: SCENES[m.npc][i] };
        if (h === 10) {
          const g = SCENE_GIFT[m.npc], before = Object.assign({}, s.herbs);
          s.gold += g.gold;
          const hb = this._herbByRarity(this._giftArea(), g.herb);
          if (hb) this.addHerb(hb.id, g.n);
          this._applyCap(before);
          ev.gift = '금화 ' + g.gold.toLocaleString('ko-KR') + ' G' + (hb ? ' · ' + hb.name + ' ×' + g.n : '');
        }
        this.events.push(ev);
      });
      return r;
    }
    _giftArea() {
      const ids = this.areaOrder.filter((id) => !this.areas[id].noGather);
      return ids[Math.floor(this.rng() * ids.length)];
    }

    // ------------------------------------------------------------ 채집 사건
    _herbByRarity(areaId, rar) {
      const a = this.areas[areaId];
      const list = (a && a.herbs && a.herbs.length ? a.herbs : this.herbList.map((h) => h.id)).map((id) => this.herbs[id]);
      let ri = RARS.indexOf(rar), pool = list.filter((h) => h.rarity === RARS[ri]);
      while (!pool.length && ri > 0) { ri -= 1; pool = list.filter((h) => h.rarity === RARS[ri]); }
      if (!pool.length) pool = list;
      return pool[Math.floor(this.rng() * pool.length)] || null;
    }

    _rollEvent(areaId, minutes) {
      const s = this.state;
      if (s.evt || this.rng() >= (EVENT_CHANCE[minutes] || 0.3)) return null;
      const a = this.areas[areaId], w = this.weatherAt(areaId), bad = !!(w && w.bad);
      const pool = EVENTS.filter((e) => (!e.regions || e.regions.indexOf(a.regionId) >= 0) && (!e.bad || bad));
      let total = pool.reduce((x, e) => x + (e.bad && bad ? e.w * 2 : e.w), 0), pick = this.rng() * total, ev = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { pick -= (pool[i].bad && bad ? pool[i].w * 2 : pool[i].w); if (pick <= 0) { ev = pool[i]; break; } }
      s.evt = { id: ev.id, area: areaId };
      return ev.id;
    }
    completeExpedition() {
      const ex = this.state.currentExpedition, minutes = ex && ex.minutes, area = ex && ex.area;
      const r = super.completeExpedition();
      if (r.ok) r.eventId = this._rollEvent(r.area || area, r.minutes || minutes);
      return r;
    }

    eventInfo() {
      const s = this.state;
      if (!s.evt) return null;
      const ev = EVENT_BY_ID[s.evt.id], a = this.areas[s.evt.area];
      return { id: ev.id, title: ev.title, text: ev.text, area: a.name,
        choices: ev.choices.map((c, i) => {
          let lock = null;
          if (c.need && this.abilLv(c.need.abil) < c.need.lv) lock = A.ABILITIES[c.need.abil].name + ' Lv.' + c.need.lv + ' 필요';
          else if (c.cost && s.gold < c.cost) lock = '금화 ' + c.cost + ' G 필요';
          return { i: i, label: c.label, need: c.need ? A.ABILITIES[c.need.abil].name + ' Lv.' + c.need.lv : null, lock: lock };
        }) };
    }
    resolveEvent(i) {
      const s = this.state;
      if (!s.evt) return F('none', '지금 겪고 있는 사건이 없다.');
      const ev = EVENT_BY_ID[s.evt.id], c = ev.choices[i];
      if (!c) return F('bad_choice', '알 수 없는 선택이다.');
      if (c.need && this.abilLv(c.need.abil) < c.need.lv) return F('need', A.ABILITIES[c.need.abil].name + ' Lv.' + c.need.lv + '이(가) 필요하다.');
      if (c.cost && s.gold < c.cost) return F('gold', '금화가 모자란다. (' + c.cost + ' G 필요)');
      const areaId = s.evt.area;
      let tw = c.outcomes.reduce((x, o) => x + o.w, 0), pick = this.rng() * tw, o = c.outcomes[c.outcomes.length - 1];
      for (let k = 0; k < c.outcomes.length; k++) { pick -= c.outcomes[k].w; if (pick <= 0) { o = c.outcomes[k]; break; } }
      const gains = [], before = Object.assign({}, s.herbs), range = (a, b) => a + Math.floor(this.rng() * (b - a + 1));
      if (c.cost) s.gold -= c.cost;
      if (o.gold) {
        const g = range(o.gold[0], o.gold[1]), real = g < 0 ? -Math.min(s.gold, -g) : g;
        s.gold += real;
        if (real) gains.push((real > 0 ? '+' : '') + real.toLocaleString('ko-KR') + ' G');
      }
      if (o.herb) {
        const h = this._herbByRarity(areaId, o.herb[0]);
        if (h) { const n = range(o.herb[1], o.herb[2]); this.addHerb(h.id, n); gains.push(h.name + ' ×' + n); }
      }
      if (o.xp) { this.addXp(o.xp); gains.push('경험치 +' + o.xp); }
      if (o.abil) { this.gainAbility(o.abil[0], o.abil[1]); gains.push(A.ABILITIES[o.abil[0]].name + ' 경험 +' + o.abil[1]); }
      let clue = null;
      if (o.clue) clue = this.grantClue();
      this._applyCap(before);
      s.stat.events += 1;
      s.evt = null;
      return { ok: true, title: ev.title, choice: c.label, text: o.text + (clue ? ' — "' + clue + '"' : ''), gains: gains,
        message: '[' + ev.title + '] ' + c.label + ' → ' + o.text + (gains.length ? ' (' + gains.join(', ') + ')' : '') };
    }

    // ------------------------------------------------------------ 시세 변동: 날마다 품목마다 ±15%
    priceSwing(kind, id) {
      return 1 - PRICE_SWING + 2 * PRICE_SWING * hash(this.config.today() + '|' + kind + '|' + id);
    }
    _unitPrice(kind, id, soldN) {
      const p = super._unitPrice(kind, id, soldN);
      return Math.max(1, Math.round(p * this.priceSwing(kind, id)));
    }
    marketNews() {
      const out = super.marketNews();
      const sw = this.herbList.map((h) => ({ h: h, f: this.priceSwing('item', h.id) })).sort((a, b) => b.f - a.f);
      const pct = (f) => Math.round((f - 1) * 100);
      out.push('오늘의 호조: ' + sw.slice(0, 2).map((x) => x.h.name + ' +' + pct(x.f) + '%').join(', '));
      out.push('오늘의 약세: ' + sw.slice(-2).reverse().map((x) => x.h.name + ' ' + pct(x.f) + '%').join(', '));
      return out;
    }

    // ------------------------------------------------------------ 다음 목표 (초보자 안내)
    nextGoals() {
      const s = this.state, c = s.counters, out = [];
      const ti = this.townInfo();
      if (!c.gathered) out.push('지도에서 초원이나 숲을 골라 이동한 뒤, 단기 채집으로 재료를 모아 보자.');
      else if (!c.brewed && !Object.keys(s.discovered).length) out.push('연금술 탭에서 재료를 2~3개 섞어 첫 물약을 만들어 보자.');
      if (c.gathered && !c.longDone) out.push('장기 채집을 한 번 해 보자. 오래 갈수록 많이 얻고, 채집 중에는 이야기가 펼쳐진다.');
      if (!s.delivered && this.boardInfo) out.push('별나루 회관 게시판이나 마을 사람에게서 의뢰를 받아 납품해 보자.');
      if (ti.canUp) out.push('회관에서 마을을 확장할 수 있다! 새 기능이 열린다.');
      const ni = CHAPTERS.findIndex((x, i) => s.chaps.indexOf(i) < 0);
      if (ni >= 0 && s.introSeen) out.push('다음 이야기 — ' + CHAPTERS[ni].title.replace(/^[^·]*· /, '') + ': ' + CHAPTERS[ni].hint);
      const tn = this.treeInfo().next;
      if (tn && s.chaps.length >= 3) out.push('세계수 묘목 → ' + tn.name + ': 자양분 ' + tn.need.toLocaleString('ko-KR') + ' (지금 ' + s.tree.pts.toLocaleString('ko-KR') + ')' + (tn.clues ? ' · 단서 ' + tn.clues + '개 (지금 ' + s.clues.length + ')' : ''));
      return out.slice(0, 3);
    }
  }

  A.GameClass = Game9;
  A.Game9 = Game9;
  A.CFG9 = { CHAPTERS: CHAPTERS.length, ACH: ACH.length, EVENTS: EVENTS.length, TREE: TREE };
})();
