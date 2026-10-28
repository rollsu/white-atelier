/*!
 * alchemy-ext.js v3 — 재료 300종 · 자유 조합 · 물건 제작 · 중앙 마을(거점·거래소·도구 거리)
 * alchemy.js(v2)의 Game 을 상속해 필요한 부분만 덮어쓴다.
 *
 *   const game = Alchemy.createGame(DATA);
 */
(function () {
  'use strict';
  const A = Alchemy;

  const TRAITS = ['활력', '평온', '집중', '기억', '정화', '환영', '결속', '회복'];
  const TCH = { '활': '활력', '평': '평온', '집': '집중', '기': '기억', '정': '정화', '환': '환영', '결': '결속', '회': '회복' };
  const CATS = { '약': '약초', '버': '버섯', '열': '열매', '광': '광물', '보': '보석', '부': '부산물', '정': '정수' };
  const CAT_ORDER = ['약', '버', '열', '광', '보', '부', '정'];
  const RARS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];         // 재료 등급: 일반 · 고급 · 희귀 · 영웅 · 전설
  const POT_RARS = ['common', 'uncommon', 'rare', 'legendary'];            // 물약은 1~4등급 그대로

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- 소지역별 새 재료 (지역마다 15종)
  // "이름 분류·등급·기운2" — 분류: 약초·버섯·열매·광물·보석·부산물·정수, 등급: 1 일반 · 2 고급 · 3 희귀
  const ITEMS_SRC = {
    moon_hill: ['달무리꽃 약1평기', '은솜풀 약1평회', '양치기쑥 약1회정', '토끼풀잎 약1활회', '달이슬 정1정평', '양의솜털 부1평결',
      '초승달버섯 버2평환', '은빛클로버 약2기평', '달그림자열매 열2평기', '월장석가루 광2기집', '양치기방울 부2집결',
      '달빛이슬결정 보3정평', '은엽달맞이 약3기환', '달나방날개 부3환기', '월광진주 보3평기'],
    golden_field: ['황금보리 약1활기', '밀짚꽃 약1활회', '들꿀방울 정1회활', '노란들국 약1집활', '종달새깃 부1활집', '볏짚매듭 부1결회',
      '해바라기낟알 열2활기', '호박빛버섯 버2활회', '황동가루 광2결활', '벌집조각 부2결회', '황금이슬 정2활정',
      '태양금잔화 약3활정', '황금종이삭 약3기활', '호박석 보3결기', '황금꿀 정3회활'],
    violet_orchard: ['자두잎 약1평기', '보랏빛꽃받침 약1환평', '과수원이슬 정1정평', '낙과 열1회활', '포도덩굴순 약1결회', '꿀벌날개 부1활집',
      '단잠자두 열2평기', '자줏빛버섯 버2환평', '꽃가루 정2환기', '나무진 부2결회', '자수정조각 보2평집',
      '몽환포도 열3환기', '자정석 보3평결', '여왕벌젤리 정3회기', '은빛과수 약3기정'],
    shade_rest: ['그늘고사리 약1평회', '쉼터이끼 약1회평', '도토리 열1활회', '매미허물 부1집환', '솔잎 약1정집', '나무껍질 부1결회',
      '느티버섯 버2평회', '숲속딸기 열2회활', '이슬방울 정2정평', '거미줄실 부2결집', '나뭇결수액 정2회결',
      '낮잠꽃 약3평환', '고목옹이 부3결회', '요정버섯 버3환평', '송진호박 보3회결'],
    wind_cliff: ['바람꽃 약1집환', '절벽쑥 약1집활', '매깃털 부1집활', '마른바람풀 약1집정', '낙석 광1결집', '바위이끼 약1회결',
      '구름버섯 버2환집', '돌풍열매 열2활집', '풍화석 광2결집', '독수리발톱 부2활집', '바람소리조개 부2환기',
      '폭풍수정 보3집활', '하늘꽃 약3환집', '번개깃 부3활환', '풍정석 보3환집'],
    snow_ridge: ['눈꽃풀 약1정집', '서리이끼 약1정회', '눈녹이물 정1정평', '얼음쑥 약1집정', '설원토끼털 부1평결', '고드름조각 광1정집',
      '설화버섯 버2정평', '한기열매 열2집정', '눈표범털 부2집결', '청빙석 광2정결', '서리이슬 정2정집',
      '만년설삼 약3집회', '빙정 보3정집', '설원의눈동자 보3기집', '백한초 약3정평'],
    storm_hill: ['먹구름풀 약1집환', '번개쑥 약1활집', '빗물 정1정활', '젖은솔잎 약1회활', '철가루 광1활결', '까마귀깃 부1집환',
      '벼락버섯 버2활집', '전기열매 열2활집', '뇌석 광2활결', '폭풍새알껍질 부2결활', '천둥이슬 정2활정',
      '뇌운꽃 약3활집', '벼락맞은수정 보3활집', '천둥새의깃 부3활환', '폭풍의눈 보3집환'],
    first_peak: ['새벽풀 약1활정', '아침이슬 정1정활', '첫햇살꽃 약1활기', '봉우리이끼 약1회활', '산새알껍질 부1결회', '금빛화강암 광1결활',
      '여명버섯 버2활정', '일출열매 열2활기', '노을석 광2활결', '금빛깃털 부2활기', '새벽빛구슬 보2정활',
      '황금새벽초 약3활기', '일출수정 보3활정', '불새의깃털 부3활회', '광휘의이슬 정3정활'],
    mist_lake: ['호숫가갈대 약1평정', '물이끼 약1정회', '안개풀 약1환평', '호수물 정1정평', '민물조개 부1결정', '조약돌 광1결평',
      '안개버섯 버2환평', '수련열매 열2평정', '진주모래 광2정결', '물총새깃 부2집정', '호수연꽃 약2평회',
      '호수은련 약3정평', '호심수정 보3정기', '안개진주 보3환정', '물정령의비늘 부3정환'],
    sea_cave: ['해초 약1정회', '산호가지 광1결회', '소금결정 광1정결', '바닷물방울 정1정활', '소라껍데기 부1결평', '작은조개 부1결회',
      '발광해초 약2환집', '심해버섯 버2환정', '진주조개 부2결기', '해마의비늘 부2회환', '검은소금 광2정결',
      '심해진주 보3결정', '인어의비늘 부3환회', '해룡의눈물 정3정환', '붉은산호수정 보3결회'],
    dawn_marsh: ['늪쑥 약1회평', '개구리밥 약1정회', '진흙이끼 약1회결', '갈대뿌리 약1결회', '늪물 정1정회', '반딧불이꼬리 부1환활',
      '안개늪버섯 버2환평', '늪딸기 열2회활', '이탄 광2결회', '도롱뇽꼬리 부2회결', '새벽안개액 정2환평',
      '인광버섯 버3환기', '늪의진주 보3환결', '도깨비불꽃 약3환활', '호박빛늪수정 보3기회'],
    star_valley: ['별가루풀 약1기환', '유성먼지 광1기집', '별빛이슬 정1정기', '계곡물 정1정평', '반딧불날개 부1환기', '별무리이끼 약1기회',
      '별빛버섯 버2기환', '운석조각 광2집결', '별열매 열2기환', '유성고사리 약2기평', '은하수방울 정2기환',
      '별똥별수정 보3기집', '성운꽃 약3기환', '별의눈물 보3평기', '유성핵 광3집활'],
    volcano_foot: ['불씨풀 약1활집', '화산재 광1결집', '유황 광1활정', '따뜻한돌 광1회활', '도마뱀허물 부1활회', '붉은이끼 약1활회',
      '화염버섯 버2활집', '불붙은열매 열2활집', '흑요석조각 광2결집', '화산새알 부2활결', '불씨이슬 정2활정',
      '용암결정 보3활결', '화염꽃 약3활집', '불도마뱀의심장 부3활회', '홍옥 보3활기'],
    burnt_forest: ['숯가루 광1정결', '그을린가지 부1결회', '재속새싹 약1회활', '검은고사리 약1회정', '불탄도토리 열1회활', '잿더미꽃 약1회평',
      '숯버섯 버2회정', '그을음열매 열2회활', '불씨이끼 약2활회', '타다남은뿔 부2결활', '재의이슬 정2회정',
      '흑탄수정 보3회결', '불꽃나비날개 부3활환', '불사의잿가루 광3회활', '되살아난뿌리 약3회활'],
    ash_ruins: ['모래풀 약1집결', '사막쑥 약1정집', '모래알 광1결집', '유적파편 광1기결', '사막도마뱀허물 부1집환', '사막이슬 정1정평',
      '선인장꽃 약2회정', '모래버섯 버2기집', '고대토기조각 부2기결', '사금 광2결활', '시간모래 정2집기',
      '문양석 보3기결', '사막장미 보3결기', '왕가의인장 부3기결', '황금사막꽃 약3집기'],
    lava_shrine: ['제단풀 약1평환', '신전이끼 약1평회', '식은용암조각 광1결평', '향불재 광1평환', '낡은향로조각 부1기평', '침묵의이슬 정1평환',
      '그림자버섯 버2평환', '흑연꽃 약2평환', '제단양초 부2기평', '용암유리 광2결환', '제단성수 정2환평',
      '침묵수정 보3평환', '성배조각 부3기평', '용암심장석 보3결활', '속삭임꽃 약3환평'],
    moss_cave: ['푹신이끼 약1회결', '이끼솜 약1회평', '동굴고사리 약1정회', '동굴물방울 정1정평', '이끼돌 광1결회', '박쥐털 부1환집',
      '이끼버섯 버2회결', '동굴딸기 열2회평', '석순조각 광2결집', '박쥐날개 부2환집', '석청 정2회결',
      '발광이끼 약3환회', '이끼옥 보3회결', '동굴정령의씨앗 열3회환', '푸른동굴수정 보3평회'],
    rock_cave: ['바위꽃 약1평결', '바위버섯 버1회평', '이끼가루 약1회정', '석회가루 광1결정', '자갈 광1결집', '동굴거미줄 부1결환',
      '종유석조각 광2결정', '철광석 광2결활', '박쥐분 부2회결', '석순버섯 버2기평', '동굴수 정2정평',
      '지하호수의눈물 정3정기', '철정수정 보3결집', '동굴의진주 보3기평', '거대버섯갓 버3회기'],
    quartz_cave: ['석영가루 광1정결', '수정파편 보1정집', '투명이끼 약1정결', '석영꽃 약1집정', '유리버섯 버1집정', '반짝이는돌 광1기집',
      '자수정석영 보2평집', '연수정 보2정기', '석영맥동 정2결정', '수정거미줄 부2결집', '수정벌레껍질 부2결정',
      '투명심장수정 보3결회', '무지개석영 보3기환', '심장울림석 광3집결', '수정꽃 약3정결'],
    ice_cave: ['얼음꽃 약1정집', '서리버섯 버1정평', '동굴얼음 광1정결', '고드름 광1정집', '얼음이끼 약1정회', '서리결정 정1정집',
      '빙하이슬 정2정기', '얼어붙은열매 열2기정', '시계태엽돌 광2집결', '얼음거미껍질 부2집정', '백색서리초 약2집정',
      '멈춘시간조각 보3기집', '청빙정 보3정결', '얼음태엽 부3집기', '영원의서리 정3정기'],
    // 고요한 숲 (신규 대지역)
    dew_path: ['아침솔잎 약1정회', '이슬거미줄 부1결정', '숲길민들레 약1활회', '이끼낀돌 광1결평', '숲바닥열매 열1회활', '나뭇잎이슬 정1정평',
      '숲길버섯 버2평회', '이슬딸기 열2회정', '고사리순 약2회평', '다람쥐털 부2활집', '숲길수액 정2회결',
      '새벽숲꽃 약3정활', '이슬호박 보3정평', '숲의진주 보3평기', '청록수정 보3회정'],
    whisper_oak: ['고목껍질 부1결회', '옹이가루 광1결집', '속삭임이끼 약1평기', '도토리모자 열1활회', '올빼미깃 부1집기', '나이테조각 광1기결',
      '고목버섯 버2기평', '귀뚜라미날개 부2환집', '늙은뿌리 약2회결', '속삭이는수액 정2기환', '까치열매 열2기활',
      '천년나이테 보3기결', '고목의눈물 정3정기', '숲지기의깃털 부3평기', '현자의이끼 약3기평'],
    mushroom_grove: ['갓버섯 버1회활', '포자가루 정1환회', '군락이끼 약1회평', '버섯뿌리 약1결회', '썩은통나무 부1결회', '버섯돌 광1결평',
      '붉은갓버섯 버2활집', '푸른포자 정2환평', '노랑버섯 버2평회', '군락열매 열2회환', '균사줄기 부2결집',
      '보랏빛갓버섯 버3환기', '황금포자 정3활기', '균사수정 보3결환', '군락의심장 보3회결'],
    firefly_glade: ['반딧불이 부1환기', '공터풀 약1활평', '이슬꽃 약1정평', '달맞이열매 열1평기', '솔방울 부1결집', '공터돌 광1결집',
      '빛나는버섯 버2환기', '반딧불꽃 약2환활', '나방비늘 부2환집', '공터이슬 정2평환', '밤나무열매 열2기평',
      '별빛이끼 약3기환', '반딧불호박 보3기환', '숲요정의날개 부3환활', '달빛공터수정 보3평기'],
    heart_root: ['굵은뿌리 약1회결', '뿌리혹 부1결회', '흙내음풀 약1회평', '땅속이끼 약1회정', '뿌리즙 정1회결', '검은흙 광1결회',
      '뿌리버섯 버2회결', '땅속열매 열2회활', '수맥석 광2정결', '뿌리의수액 정2회활', '지렁이분 부2회결',
      '세계수잔뿌리 약3회활', '심장수액 정3회활', '뿌리호박 보3회결', '대지의심장석 보3결회'],
  };

  // ---------------------------------------------------------------- 중앙 마을
  const HUB = {
    id: 'center', name: '중앙 마을 별나루', theme: '마을',
    description: '다섯 땅의 길이 모이는 중앙 마을. 약초꾼과 상인, 대장장이가 한데 모여 산다.',
    areas: [
      { id: 'camp', name: '약초사의 거점', type: '거점', signature: null, herbs: [], noGather: true,
        description: '마을 어귀의 작은 오두막. 쉬어 가거나 공방에서 물건을 만들 수 있다.',
        service: '쉬기 · 공방(물건 제작)' },
      { id: 'market', name: '중앙 거래소', type: '거래소', signature: null, herbs: [], noGather: true,
        description: '재료와 물약, 물건이 매일 다른 값으로 오가는 큰 장터. 오늘의 호황 품목이 게시판에 붙는다.',
        service: '재료·물약·물건 팔기 · 재료 사기' },
      { id: 'tool_street', name: '도구 거리', type: '상점가', signature: null, herbs: [], noGather: true,
        description: '낫과 곡괭이, 솥과 증류기를 파는 가게가 늘어선 골목. 쓸수록 손에 익는 도구를 고를 수 있다.',
        service: '채집·연금술 도구 구매와 강화' },
      { id: 'town_hall', name: '별나루 회관', type: '회관', signature: null, herbs: [], noGather: true,
        description: '마을 사람들이 모여 의뢰를 붙이고 마을의 앞날을 의논하는 큰 회관. 안쪽 게시판에는 날마다 새 의뢰가 붙는다.',
        service: '의뢰 게시판 · 마을 업그레이드' },
    ],
  };

  // ---------------------------------------------------------------- 고요한 숲 (대지역 + 소지역 5곳)
  // signatureName 은 재료 이름. 재료가 만들어질 때 그 id 로 signature 가 채워진다.
  const FOREST = {
    id: 'forest', name: '고요한 숲', theme: '숲',
    description: '오래된 나무와 이끼, 버섯이 빽빽한 숲. 바람이 잦아들어 발소리마저 조용해진다.',
    areas: [
      { id: 'dew_path', name: '이슬 맺힌 숲길', type: '숲길', signature: null, signatureName: '새벽숲꽃', herbs: [],
        description: '이른 아침이면 나뭇잎마다 이슬이 맺혀 길 전체가 반짝이는 숲길.' },
      { id: 'whisper_oak', name: '속삭이는 고목', type: '고목', signature: null, signatureName: '고목버섯', herbs: [],
        description: '속이 빈 거대한 고목. 바람이 지나가면 옛이야기 같은 소리가 난다.' },
      { id: 'mushroom_grove', name: '버섯 군락지', type: '군락', signature: null, signatureName: '갓버섯', herbs: [],
        description: '발밑이 온통 알록달록한 버섯으로 덮인 습한 군락지.' },
      { id: 'firefly_glade', name: '반딧불 숲 공터', type: '공터', signature: null, signatureName: '반딧불이', herbs: [],
        description: '밤이면 수천 마리의 반딧불이가 모여드는 숲속의 둥근 공터.' },
      { id: 'heart_root', name: '뿌리의 심장', type: '거대한 뿌리', signature: null, signatureName: '굵은뿌리', herbs: [],
        description: '숲 전체의 뿌리가 한데 얽혀 맥박처럼 뛰는 땅속 깊은 곳.' },
    ],
  };

  // ---------------------------------------------------------------- 전설 재료 (대지역마다 하나씩 특산)
  // 장기 채집을 마칠 때 1% 보너스로, 그 대지역의 특산 전설 재료가 나온다.
  // 처음에는 새 전설 재료 3종(초원·물가·숲)을 추가했고, 산맥·화산·동굴은 기존 전설 재료가 특산이다.
  // (추후: 아주 낮은 확률로 의뢰 보상으로도 얻을 수 있게 한다)
  const NEW_LEGENDS = [
    { id: 'dalmurigwan', name: '달무리 월계관', rarity: 'legendary', cat: '약', traits: ['평온', '기억'], element: '달', habitat: '은빛 초원',
      effect: '달빛을 머금어 마음의 파도를 완전히 잠재운다.', lore: '초원에 달무리가 두 겹으로 서는 밤에만 월계수 모양으로 피어난다고 한다.' },
    { id: 'simyeonkkot', name: '심연의 눈물꽃', rarity: 'legendary', cat: '약', traits: ['정화', '환영'], element: '물', habitat: '푸른 물가',
      effect: '가장 깊은 물의 맑음을 모아, 모든 탁함을 꿈처럼 씻어낸다.', lore: '바다와 호수와 계곡이 만나는 깊은 곳에서 눈물처럼 피어난다.' },
    { id: 'supgwan', name: '숲의 왕관', rarity: 'legendary', cat: '버', traits: ['기억', '결속'], element: '숲', habitat: '고요한 숲',
      effect: '숲 전체의 기억을 한데 묶어 하나의 힘으로 만든다.', lore: '오래된 숲의 정적이 가장 깊어진 곳에서 왕관 모양 갓을 펼친다.' },
  ];
  const REGION_LEGEND = { grassland: 'dalmurigwan', mountain: 'yeomyeonggwan', waters: 'simyeonkkot', volcano: 'bulsajaekkot', caves: 'sichimcho', forest: 'supgwan' };

  // ---------------------------------------------------------------- 계절 한정 재료
  // 그 계절에만 채집된다(계절이 지나면 지역 재료 목록에서 빠진다). 형식은 ITEMS_SRC 와 같다.
  const SEASONAL = [
    { season: 'spring', areas: ['moon_hill', 'golden_field', 'violet_orchard', 'shade_rest', 'dew_path', 'whisper_oak'],
      items: ['봄바람꽃 약2활환', '새순이슬 정2회정', '벚빛꽃비 약2평회', '연분홍안개 정3환회'] },
    { season: 'summer', areas: ['mist_lake', 'sea_cave', 'star_valley', 'dawn_marsh', 'volcano_foot', 'ash_ruins'],
      items: ['청량수초 약2정활', '뙤약볕열매 열2활기', '한여름허물 부2집환', '소낙비구슬 보3정활'] },
    { season: 'autumn', areas: ['wind_cliff', 'snow_ridge', 'first_peak', 'storm_hill', 'mushroom_grove', 'firefly_glade', 'golden_field'],
      items: ['단풍잎조각 약2기결', '가을걷이낟알 열2결회', '서리맞은버섯 버3정기', '낙엽호박 보3결기'] },
    { season: 'winter', areas: ['snow_ridge', 'ice_cave', 'rock_cave', 'moss_cave', 'mist_lake', 'heart_root'],
      items: ['눈송이결정 정2정집', '동지열매 열2활결', '고드름꽃 약3정집', '한파수정 보3집결'] },
  ];

  // ---------------------------------------------------------------- 도구
  // 단계별 효과표 (0~7단계). 8~10단계는 아직 정해지지 않았다.
  const TOOL_FX = {
    sickle: [0, 0.15, 0.30, 0.45, 0.58, 0.70, 0.80, 0.90],     // 단기 채집 때 약초 +1 확률
    boots: [0, 0.10, 0.20, 0.30, 0.37, 0.44, 0.50, 0.55],      // 단기 채집 대기시간 감소
    pickaxe: [0.35, 1, 1.5, 2, 2.4, 2.8, 3.2, 3.6],            // 광물·보석 출현 배율
    lens: [0, 0.15, 0.30, 0.45, 0.58, 0.70, 0.80, 0.90],       // 희귀 재료 출현 가중치 증가분
    basket: [0, 0.10, 0.20, 0.30, 0.38, 0.46, 0.53, 0.60],     // 장기 채집 수확 증가분
    cauldron: [0, 0, 4, 8, 11, 14, 17, 20],                    // 조합 성공 확률 +%p
    mortar: [0, 12, 22, 32, 40, 47, 53, 58],                   // 재료 환급 확률 %
  };
  const pct = function (v) { return Math.round(v * 100); };
  const up = function (a, i, f) { return a.slice(i).map(f); };
  const TOOLS = [
    { id: 'sickle', name: '채집 낫', kind: '채집', max: 7, costs: [120, 450, 1400, 3200, 6500, 12000, 22000],
      label: ['효과 없음'].concat(up(TOOL_FX.sickle, 1, function (v) { return '단기 채집 때 ' + pct(v) + '% 확률로 약초 +1'; })) },
    { id: 'boots', name: '여행 장화', kind: '채집', max: 7, costs: [150, 500, 1500, 3400, 7000, 13000, 24000],
      label: ['효과 없음'].concat(up(TOOL_FX.boots, 1, function (v) { return '단기 채집 대기시간 -' + pct(v) + '%'; })) },
    { id: 'pickaxe', name: '곡괭이', kind: '채집', max: 7, costs: [100, 400, 1300, 3000, 6200, 11500, 21000],
      label: ['광물·보석이 거의 나오지 않는다 (출현 ×0.35)'].concat(up(TOOL_FX.pickaxe, 1, function (v) { return '광물·보석 출현 ×' + v.toFixed(1); })) },
    { id: 'lens', name: '약초 돋보기', kind: '채집', max: 7, costs: [200, 700, 2000, 4400, 8800, 16000, 29000],
      label: ['효과 없음'].concat(up(TOOL_FX.lens, 1, function (v) { return '희귀 재료 출현 가중치 ×' + (1 + v).toFixed(2); })) },
    { id: 'basket', name: '약초 바구니', kind: '채집', max: 7, costs: [180, 600, 1800, 4000, 8000, 15000, 27000],
      label: ['효과 없음'].concat(up(TOOL_FX.basket, 1, function (v) { return '장기 채집 수확 +' + pct(v) + '%'; })) },
    { id: 'cauldron', name: '약탕기', kind: '연금술', max: 7, costs: [0, 350, 1100, 2600, 5200, 9800, 18000],
      label: ['없음', '기본 솥 (보정 없음)'].concat(up(TOOL_FX.cauldron, 2, function (v) { return '조합 성공 확률 +' + v + '%p'; })) },
    { id: 'mortar', name: '절구', kind: '연금술', max: 7, costs: [250, 800, 2200, 4800, 9500, 17000, 30000],
      label: ['효과 없음'].concat(up(TOOL_FX.mortar, 1, function (v) { return '조합할 때 ' + v + '% 확률로 재료 하나를 돌려받는다'; })) },
    { id: 'forge', name: '화로와 모루', kind: '공방', max: 7, costs: [300, 1200, 3000, 6500, 13000, 24000, 42000],
      label: ['금속·보석 물건을 만들 수 없다', '기본 금속 물건 제작', '고급 금속 물건 제작, 판매가 +5%', '최고급 금속 물건 제작, 판매가 +10%',
        '최고급 금속 물건 제작, 판매가 +15%', '최고급 금속 물건 제작, 판매가 +20%', '최고급 금속 물건 제작, 판매가 +25%', '최고급 금속 물건 제작, 판매가 +30%'] },
    { id: 'alembic', name: '증류기', kind: '공방', max: 7, costs: [300, 1200, 3000, 6500, 13000, 24000, 42000],
      label: ['증류 물건을 만들 수 없다', '기본 증류 물건 제작', '고급 증류 물건 제작, 판매가 +5%', '최고급 증류 물건 제작, 판매가 +10%',
        '최고급 증류 물건 제작, 판매가 +15%', '최고급 증류 물건 제작, 판매가 +20%', '최고급 증류 물건 제작, 판매가 +25%', '최고급 증류 물건 제작, 판매가 +30%'] },
    { id: 'broom', name: '마법의 빗자루', kind: '이동', max: 1, costs: [1500],
      label: ['없음', '이동 시간 -20% (이동할 때마다 마나 12 소모, 마나가 모자라면 걸어서 간다)'] },
  ];
  const TOOL_BY_ID = {};
  TOOLS.forEach(function (t) { TOOL_BY_ID[t.id] = t; });

  // ---------------------------------------------------------------- 물건(공방)
  // req: [분류, 개수, (기운)]   tool 이 있으면 그 도구가 lv 이상이어야 한다.
  const GOODS = [
    { id: 'g_tea', name: '약초 차 묶음', tool: null, lv: 0, req: [['약', 3]], price: 34, desc: '말린 약초를 곱게 묶은 차.' },
    { id: 'g_sachet', name: '향 주머니', tool: null, lv: 0, req: [['약', 2], ['부', 1]], price: 52, desc: '옷장에 넣어 두는 은은한 향 주머니.' },
    { id: 'g_jam', name: '과실 잼', tool: null, lv: 0, req: [['열', 3]], price: 50, desc: '약초사의 아침 식탁에 오르는 달콤한 잼.' },
    { id: 'g_jerky', name: '버섯 육포', tool: null, lv: 0, req: [['버', 2], ['열', 1]], price: 60, desc: '여행길 간식으로 사랑받는 말린 버섯.' },
    { id: 'g_candle', name: '약초 향초', tool: null, lv: 0, req: [['약', 1], ['부', 2]], price: 62, desc: '타는 동안 마음이 가라앉는 향초.' },
    { id: 'g_pickle', name: '약초 절임', tool: null, lv: 0, req: [['약', 2], ['광', 1]], price: 58, desc: '소금에 절여 오래 두는 약초.' },
    { id: 'g_soap', name: '약초 비누', tool: null, lv: 0, req: [['약', 2], ['정', 1]], price: 68, desc: '거품에서 풀 내음이 나는 비누.' },
    { id: 'g_bathsalt', name: '목욕 소금', tool: null, lv: 0, req: [['광', 2], ['약', 1]], price: 70, desc: '더운물에 풀면 피로가 녹는 소금.' },
    { id: 'g_syrup', name: '꿀 시럽', tool: null, lv: 0, req: [['정', 1], ['열', 2]], price: 76, desc: '감기에 좋다고 소문난 진한 시럽.' },
    { id: 'g_salve', name: '상처 연고', tool: null, lv: 0, req: [['약', 1, '회복'], ['버', 1], ['부', 1]], price: 92, desc: '찰과상에 바르면 금세 새살이 돋는다.' },

    { id: 'g_water', name: '증류 정제수', tool: 'alembic', lv: 1, req: [['정', 3]], price: 135, desc: '불순물 하나 없이 맑은 물.' },
    { id: 'g_perfume', name: '꽃 향수', tool: 'alembic', lv: 1, req: [['약', 2], ['정', 1]], price: 150, desc: '손목에 한 방울이면 하루가 향기롭다.' },
    { id: 'g_oil', name: '정유 한 병', tool: 'alembic', lv: 1, req: [['정', 2], ['약', 1]], price: 175, desc: '약초의 기운만 뽑아낸 기름.' },
    { id: 'g_incense', name: '선향 다발', tool: 'alembic', lv: 1, req: [['약', 2], ['광', 1], ['정', 1]], price: 190, desc: '사원에서 찾는 곧은 향.' },
    { id: 'g_mistoil', name: '안개 향유', tool: 'alembic', lv: 2, req: [['정', 1, '환영'], ['약', 2], ['부', 1]], price: 320, desc: '바르면 눈앞이 뽀얗게 흐려지는 신비한 향유.' },
    { id: 'g_starelix', name: '별빛 엑기스', tool: 'alembic', lv: 2, req: [['정', 2, '기억'], ['보', 1]], price: 480, desc: '기억을 또렷하게 해 준다는 푸른 엑기스.' },
    { id: 'g_dew', name: '만능 이슬병', tool: 'alembic', lv: 2, req: [['정', 3], ['보', 1]], price: 560, desc: '여러 땅의 이슬을 한 병에 모았다.' },

    { id: 'g_ring', name: '은장 반지', tool: 'forge', lv: 1, req: [['광', 2]], price: 110, desc: '소박하지만 단단하게 두들긴 반지.' },
    { id: 'g_bell', name: '바람 방울', tool: 'forge', lv: 1, req: [['광', 1], ['부', 2]], price: 130, desc: '바람이 불면 맑은 소리를 내는 방울.' },
    { id: 'g_mortarset', name: '약사발 세트', tool: 'forge', lv: 1, req: [['광', 3]], price: 150, desc: '약초사의 필수품, 사발과 막자.' },
    { id: 'g_dagger', name: '약초 칼', tool: 'forge', lv: 1, req: [['광', 2], ['부', 1]], price: 165, desc: '줄기를 깨끗하게 베는 작은 칼.' },
    { id: 'g_pendant', name: '수정 목걸이', tool: 'forge', lv: 1, req: [['보', 1], ['광', 1]], price: 190, desc: '빛을 받으면 은은히 반짝이는 목걸이.' },
    { id: 'g_earring', name: '별조각 귀걸이', tool: 'forge', lv: 2, req: [['보', 1, '기억'], ['광', 1]], price: 250, desc: '밤하늘을 귀에 매단 듯한 귀걸이.' },
    { id: 'g_amulet', name: '호신 부적', tool: 'forge', lv: 2, req: [['광', 1], ['부', 1], ['보', 1]], price: 270, desc: '여행자가 품에 지니는 부적.' },
    { id: 'g_lamp', name: '결정 등잔', tool: 'forge', lv: 2, req: [['보', 1], ['정', 1], ['광', 1]], price: 310, desc: '기름 없이도 은은히 타오르는 등잔.' },
    { id: 'g_brooch', name: '보석 브로치', tool: 'forge', lv: 2, req: [['보', 2]], price: 330, desc: '귀족 부인들이 앞다퉈 찾는 장식.' },
    { id: 'g_mask', name: '환영 가면', tool: 'forge', lv: 2, req: [['부', 2, '환영'], ['보', 1]], price: 340, desc: '쓰면 얼굴이 안개처럼 흐려지는 가면.' },
    { id: 'g_hourglass', name: '작은 모래시계', tool: 'forge', lv: 2, req: [['보', 1, '집중'], ['광', 1], ['정', 1]], price: 400, desc: '모래가 떨어지는 동안 잡생각이 사라진다.' },
    { id: 'g_relic', name: '고대 유물 모조품', tool: 'forge', lv: 3, req: [['광', 2], ['보', 1], ['부', 2]], price: 640, desc: '수집가들은 진품인지 아닌지 신경 쓰지 않는다.' },
    { id: 'g_crown', name: '약초왕관', tool: 'forge', lv: 3, req: [['보', 2], ['약', 2], ['광', 1]], price: 720, desc: '축제의 약초 여왕이 쓰는 화려한 왕관.' },
    { id: 'g_orb', name: '기운 구슬', tool: 'forge', lv: 3, req: [['보', 2], ['정', 2]], price: 880, desc: '손바닥 위에서 기운이 맴도는 구슬.' },
  ];

  // ---------------------------------------------------------------- 자유 조합 물약
  const PRI_NOUN = { '활력': '활기', '평온': '안식', '집중': '명철', '기억': '회상', '정화': '맑음', '환영': '몽환', '결속': '결속', '회복': '회생' };
  const SEC_ADJ = { '활력': '불꽃빛', '평온': '달빛', '집중': '서리빛', '기억': '별빛', '정화': '이슬빛', '환영': '안개빛', '결속': '진주빛', '회복': '새싹빛' };
  const FORM = ['', '차', '탕약', '비약', '영약'];
  const PT_PRICE = [0, 40, 125, 350, 1000];

  function ptEffect(trait, tier) {
    const t = Math.max(1, Math.min(4, tier));
    switch (trait) {
      case '활력': { const v = [0, 12, 22, 34, 50][t], n = [0, 1, 2, 2, 3][t];
        return { type: 'yield_boost', value: v, duration: { unit: 'expedition', amount: n }, description: '다음 장기 채집 ' + n + '회 동안 수확량 +' + v + '%.' }; }
      case '평온': { const v = [0, 1, 1, 2, 3][t];
        return { type: 'weather_shield', value: v, duration: { unit: 'charge', amount: v }, description: '날씨 보호막 ' + v + '회. 나쁜 날씨의 피해를 ' + v + '번 막아 준다.' }; }
      case '집중': { const v = [0, 10, 18, 28, 40][t], n = [0, 1, 2, 2, 3][t];
        return { type: 'xp_boost', value: v, duration: { unit: 'expedition', amount: n }, description: '다음 장기 채집 ' + n + '회 동안 연금술 경험치 +' + v + '%.' }; }
      case '기억': { const v = [0, 4, 8, 14, 25][t], n = [0, 2, 2, 3, 3][t];
        return { type: 'rare_chance', value: v, duration: { unit: 'gather', amount: n }, description: '다음 채집 ' + n + '회(단기·장기) 동안 희귀 재료 출현 가중치 +' + (v * 10) + '%.' }; }
      case '정화': { const v = [0, 1, 2, 3, 99][t];
        const n = v >= 99 ? 10 : v * 2;
        return { type: 'weather_ward', value: v, duration: { unit: 'gather', amount: n }, description: '다음 채집 ' + n + '회 동안 나쁜 날씨의 피해를 받지 않는다.' }; }
      case '환영': { const v = [0, 1, 1, 2, 2][t], n = [0, 2, 3, 3, 4][t];
        return { type: 'herb_bonus', value: v, duration: { unit: 'short', amount: n }, description: '다음 단기 채집 ' + n + '회 동안 재료를 ' + v + '개 더 얻는다.' }; }
      case '결속': { const v = [0, 4, 7, 11, 16][t], n = [0, 2, 3, 3, 4][t];
        return { type: 'brew_chance', value: v, duration: { unit: 'brew', amount: n }, description: '다음 조합 ' + n + '회 동안 성공 확률 +' + v + '%p.' }; }
      default: { const v = [0, 3, 5, 8, 12][t], n = [0, 3, 4, 5, 6][t];
        return { type: 'cooldown_cut', value: v, duration: { unit: 'short', amount: n }, description: '다음 단기 채집 ' + n + '회 동안 대기시간 ' + v + '초 단축.' }; }
    }
  }

  function itemPrice(rarity, cat, key) {
    const base = [6, 20, 58, 120, 220][RARS.indexOf(rarity)];
    const cm = { '약': 1, '버': 1.1, '열': 0.9, '광': 0.9, '보': 1.8, '부': 1, '정': 1.2 }[cat] || 1;
    return Math.max(2, Math.round(base * cm * (0.88 + 0.24 * hash(key))));
  }

  // ---------------------------------------------------------------- 게임
  class Game3 extends A.Game {
    constructor(opts) {
      super(opts);
      this.goodList = GOODS;
      this.goodDefs = {};
      GOODS.forEach(function (g) { this.goodDefs[g.id] = g; }, this);
      this.potionList.forEach(function (p) {
        if (p.price === undefined) p.price = Math.round(PT_PRICE[p.tier] * (1 + 0.3 * (p.effects.length - 1)));
      });
      this.migrate();
    }

    // ------------------------------------------------------------ 저장 · 이전 판 호환
    migrate() {
      const s = this.state;
      if (s.gold === undefined) s.gold = 100;
      s.tools = s.tools || {};
      if (!s.tools.cauldron) s.tools.cauldron = 1;
      ['goods', 'sold', 'bought', 'seen', 'made'].forEach(function (k) { s[k] = s[k] || {}; });
      if (s.marketDate === undefined) s.marketDate = '';
      if (s.restDate === undefined) s.restDate = '';
      Object.keys(s.potions).forEach(function (id) { this.ensurePotion(id); }, this);
      Object.keys(s.discovered).forEach(function (id) { this.ensurePotion(id); }, this);
      this.markSeen();
      return this;
    }

    load(json) {
      super.load(json);
      return this.migrate();
    }

    reset() {
      this.state = A.createState(this.config.today());
      this.state.location = null;
      this._ensureLocation();
      return this.migrate();
    }

    _ensureLocation() {
      if (!this.state.location || !this.areas[this.state.location]) this.state.location = 'camp';
    }

    _rollDay() {
      super._rollDay();
      const s = this.state, t = this.config.today();
      if (s.marketDate !== undefined && s.marketDate !== t) {
        s.marketDate = t; s.sold = {}; s.bought = {};
      }
    }

    markSeen() {
      const s = this.state;
      Object.keys(s.herbs).forEach(function (id) { if (s.herbs[id] > 0) s.seen[id] = true; });
    }

    // ------------------------------------------------------------ 도구
    toolLv(id) { return this.state.tools[id] || 0; }

    toolList() {
      return TOOLS.map(function (t) {
        const lv = this.toolLv(t.id);
        return { id: t.id, name: t.name, kind: t.kind, lv: lv, max: t.max, label: t.label[lv],
          nextLabel: lv < t.max ? t.label[lv + 1] : null, cost: lv < t.max ? t.costs[lv] : null };
      }, this);
    }

    buyTool(id) {
      this._rollDay();
      const t = TOOL_BY_ID[id], s = this.state;
      if (!t) return fail3('unknown_tool', '알 수 없는 도구입니다.');
      if (s.location !== 'tool_street') return fail3('not_here', '도구 거리에서만 살 수 있다.');
      const lv = this.toolLv(id);
      if (lv >= t.max) return fail3('max', t.name + '은(는) 이미 최고 단계다.');
      const cost = t.costs[lv];
      if (s.gold < cost) return fail3('gold', '금화가 모자란다. (' + cost + ' G 필요)');
      s.gold -= cost;
      s.tools[id] = lv + 1;
      return { ok: true, name: t.name, lv: lv + 1, cost: cost, label: t.label[lv + 1],
        message: t.name + ' Lv.' + (lv + 1) + '을(를) 장만했다. ' + t.label[lv + 1] };
    }

    _catMult(cat) {
      if (cat === '광' || cat === '보') return this._fx('pickaxe');
      return 1;
    }

    // 능력치(ext2.js)가 덮어쓰는 보정 훅 — 여기서는 보정 없음
    _toolEff() { return 1; }
    _extraChance() { return 0; }
    _extraRolls() { return 0; }
    _rareExtra() { return 1; }
    _herbMult() { return 1; }        // 날씨·계절의 특산 재료 가중치 (ext4.js)

    // 도구 단계별 효과 (TOOL_FX). 정의된 최고 단계(7)를 넘으면 7단계 값을 쓴다
    _fx(id) { return TOOL_FX[id][Math.min(7, this.toolLv(id))]; }

    _rareMult() { return super._rareMult() * (1 + this._fx('lens') * this._toolEff()) * this._rareExtra(); }

    // ------------------------------------------------------------ 채집
    _rarityWeights(kind, areaId, mult) {
      if (!this.areas[areaId].herbs.length) return { w: {}, total: 0 };
      return super._rarityWeights(kind, areaId, mult);
    }

    _pickHerb(kind, areaId, mult) {
      const area = this.areas[areaId];
      const r = this._rarityWeights(kind, areaId, mult);
      let x = this.rng() * r.total, rarity = null;
      const keys = Object.keys(r.w);
      for (let i = 0; i < keys.length; i++) {
        x -= r.w[keys[i]];
        if (x < 0 || i === keys.length - 1) { rarity = keys[i]; break; }
      }
      const pool = area.herbs.filter(function (id) { return this.herbs[id].rarity === rarity; }, this);
      const weights = pool.map(function (id) {
        return (id === area.signature ? this.config.signatureBonus : 1) * this._catMult(this.herbs[id].cat) * this._herbMult(id, areaId);
      }, this);
      let t = this.rng() * weights.reduce(function (a, b) { return a + b; }, 0);
      for (let i = 0; i < pool.length; i++) {
        t -= weights[i];
        if (t < 0) return pool[i];
      }
      return pool[pool.length - 1];
    }

    gatherOdds(kind, areaId) {
      areaId = areaId || this.state.location;
      if (!this.areas[areaId].herbs.length) return {};
      return super.gatherOdds(kind, areaId);
    }

    _noGather() {
      const a = this.currentArea();
      return a.noGather ? fail3('no_gather', a.name + '에서는 재료가 자라지 않는다. 지도에서 다른 곳으로 이동하자.') : null;
    }

    shortGather() {
      const ng = this._noGather();
      if (ng) return ng;
      const r = super.shortGather();
      if (!r.ok) return r;
      const s = this.state;
      const sk = this.toolLv('sickle');
      if ((sk > 0 || this._extraChance() > 0) && this.rng() < this._fx('sickle') * this._toolEff() + this._extraChance()) {
        s.herbs[r.herbId] += 1; r.amount += 1; r.sickle = true;
      }
      const bt = this.toolLv('boots');
      if (bt > 0) {
        const cd = Math.max(0.5, r.cooldownSec * (1 - Math.min(0.8, this._fx('boots') * this._toolEff())));
        s.shortReadyAt = this.config.now() + Math.round(cd * 1000);
        r.cooldownSec = Math.round(cd * 10) / 10;
      }
      this.markSeen();
      return r;
    }

    startExpedition(minutes) {
      const ng = this._noGather();
      if (ng) return ng;
      return super.startExpedition(minutes);
    }

    completeExpedition() {
      const mult = this._rareMult();
      const r = super.completeExpedition();
      if (!r.ok) return r;
      const lv = this.toolLv('basket');
      const n = Math.round(r.rolls * (this._fx('basket') * this._toolEff() + this._extraRolls()));
      if (n > 0) {
        const got = this._loot(r.minutes, r.area, n, mult), s = this.state;
        Object.keys(got).forEach(function (id) { s.herbs[id] = (s.herbs[id] || 0) + got[id]; });
        const merged = {};
        r.herbs.concat(this._summarize(got)).forEach(function (h) { merged[h.id] = (merged[h.id] || 0) + h.amount; });
        r.herbs = this._summarize(merged);
        r.basketExtra = n;
      }
      this.markSeen();
      return r;
    }

    areaHerbs(areaId) {
      const list = super.areaHerbs(areaId);
      return list.map(function (h) { h.cat = this.herbs[h.id].cat; return h; }, this)
        .sort(function (a, b) {
          return A.RARITIES.indexOf(b.rarity) - A.RARITIES.indexOf(a.rarity) || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat);
        });
    }

    // ------------------------------------------------------------ 연금술 (물약)
    ensurePotion(id) {
      if (this.potions[id]) return this.potions[id];
      const m = /^pt:([^:]+):([^:]+):(\d)$/.exec(id);
      if (!m) return null;
      const pri = m[1], sec = m[2], tier = Number(m[3]);
      const effects = [ptEffect(pri, tier)];
      if (tier >= 3) effects.push(ptEffect(sec, tier - 2));
      const p = {
        id: id, name: SEC_ADJ[sec] + ' ' + PRI_NOUN[pri] + ' ' + FORM[tier], tier: tier, rarity: POT_RARS[tier - 1],
        ingredients: null, recipeKey: id, effects: effects, primary: pri, secondary: sec, proc: true,
        description: effects.map(function (e) { return e.description; }).join(' '),
        hint: '', price: Math.round(PT_PRICE[tier] * (tier >= 3 ? 1.35 : 1)),
      };
      this.potions[id] = p;
      return p;
    }

    // 재료의 기운을 세어 가장 강한 두 기운과 등급(재료 희귀도 평균)으로 물약을 정한다.
    _traitPair(ids) {
      const counts = {};
      ids.forEach(function (id) {
        this.herbs[id].traits.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      }, this);
      const sorted = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a] || TRAITS.indexOf(a) - TRAITS.indexOf(b);
      });
      return [sorted[0], sorted[1]];
    }

    predictTraits(ids) { return this._traitPair(ids); }

    resolveRecipe(ids) {
      const fixed = this.recipes[A.recipeKey(ids)];
      if (fixed) return fixed;
      const pair = this._traitPair(ids);
      const avg = ids.reduce(function (a, id) { return a + Math.min(3, A.RARITIES.indexOf(this.herbs[id].rarity)); }.bind(this), 0) / ids.length;
      const tier = Math.max(1, Math.min(4, 1 + Math.floor(avg + 0.4)));
      return this.ensurePotion('pt:' + pair[0] + ':' + pair[1] + ':' + tier);
    }

    _chanceFor(recipe) {
      const c = this.config;
      const bonus = this._fx('cauldron') * this._toolEff();
      return Math.min(c.maxBrewChance, Math.round((super._chanceFor(recipe) + bonus) * 10) / 10);
    }

    brewChance(ids) {
      if (!Array.isArray(ids) || ids.length < 2) return null;
      const recipe = this.resolveRecipe(ids);
      return this.state.discovered[recipe.recipeKey] ? this._chanceFor(recipe) : null;
    }

    brew(ids) {
      this._rollDay();
      const s = this.state;
      if (s.phase !== 'idle') return fail3('busy', '장기 채집 중에는 연금술을 할 수 없습니다.');
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 3) return fail3('bad_count', '재료는 2~3가지를 섞어야 합니다.');
      if (new Set(ids).size !== ids.length) return fail3('duplicate', '같은 재료는 한 번만 넣을 수 있습니다.');
      for (let i = 0; i < ids.length; i++) {
        if (!this.herbs[ids[i]]) return fail3('unknown_herb', '알 수 없는 재료입니다.');
        if (this.herbCount(ids[i]) < 1) return fail3('missing_herb', this.herbs[ids[i]].name + '이(가) 부족합니다.');
      }
      const recipe = this.resolveRecipe(ids);
      const chance = this._chanceFor(recipe);
      ids.forEach(function (id) { s.herbs[id] -= 1; });

      let refunded = null;
      const rf = this._active('brew_refund');
      const pct = (rf ? rf.value : 0) + [0, 12, 22, 32][this.toolLv('mortar')];
      if (pct > 0 && this.rng() * 100 < pct) {
        refunded = ids[Math.floor(this.rng() * ids.length)];
        s.herbs[refunded] += 1;
      }
      this._tick('brew');

      if (this.rng() * 100 >= chance) {
        const lv = this.addXp(this.config.brewXpFail);
        return { ok: false, code: 'fizzle', chance: chance, refunded: refunded, levelsGained: lv,
          message: '솥이 끓어 넘쳐 재료를 잃었다. 기운은 분명 어우러지고 있었는데…' };
      }
      s.potions[recipe.id] = (s.potions[recipe.id] || 0) + 1;
      const isNew = !s.discovered[recipe.recipeKey];
      s.discovered[recipe.recipeKey] = true;
      const lv = this.addXp(this.config.brewXpSuccess * recipe.tier);
      return { ok: true, potionId: recipe.id, name: recipe.name, tier: recipe.tier, chance: chance,
        newDiscovery: isNew, refunded: refunded, levelsGained: lv,
        message: (isNew ? '새로운 조합을 발견했다! ' : '') + recipe.name + '을(를) 완성했다.' };
    }

    freeBook() {
      const out = [];
      Object.keys(this.state.discovered).forEach(function (k) {
        if (k.indexOf('pt:') === 0) out.push(this.ensurePotion(k));
      }, this);
      out.sort(function (a, b) { return a.tier - b.tier || (a.name < b.name ? -1 : 1); });
      return { found: out, total: TRAITS.length * (TRAITS.length - 1) * 4 };
    }

    ownedPotions() {
      const s = this.state;
      return Object.keys(s.potions).filter(function (id) { return s.potions[id] > 0; })
        .map(function (id) { return this.ensurePotion(id); }, this)
        .filter(Boolean)
        .sort(function (a, b) { return b.tier - a.tier || (a.name < b.name ? -1 : 1); });
    }

    // ------------------------------------------------------------ 연금술 (물건)
    _pickForReq(req) {
      const left = {}, pick = {};
      const s = this.state;
      Object.keys(s.herbs).forEach(function (k) { left[k] = s.herbs[k]; });
      for (let i = 0; i < req.length; i++) {
        const cat = req[i][0], trait = req[i][2];
        let need = req[i][1];
        const label = (CATS[cat] || '재료') + (trait ? '(' + trait + ')' : '');
        const cands = this.herbList.filter(function (h) {
          return h.cat === cat && (!trait || h.traits.indexOf(trait) >= 0) && left[h.id] > 0;
        }).sort(function (a, b) { return a.price - b.price || (a.id < b.id ? -1 : 1); });
        for (let j = 0; j < cands.length && need > 0; j++) {
          const take = Math.min(need, left[cands[j].id]);
          left[cands[j].id] -= take; pick[cands[j].id] = (pick[cands[j].id] || 0) + take; need -= take;
        }
        if (need > 0) return { ok: false, reason: label + ' ' + need + '개가 더 필요하다.' };
      }
      return { ok: true, pick: pick };
    }

    goodPrice(id) {
      const g = this.goodDefs[id];
      return Math.round(g.price * (g.tool ? 1 + 0.05 * Math.max(0, this.toolLv(g.tool) - 1) : 1));
    }

    goodsPreview(id) {
      const g = this.goodDefs[id];
      if (g.tool && this.toolLv(g.tool) < g.lv) {
        return { ok: false, locked: true, reason: TOOL_BY_ID[g.tool].name + ' Lv.' + g.lv + ' 이상이 필요하다.' };
      }
      return this._pickForReq(g.req);
    }

    craftGood(id) {
      this._rollDay();
      const s = this.state, g = this.goodDefs[id];
      if (!g) return fail3('unknown_good', '알 수 없는 물건입니다.');
      if (s.phase !== 'idle') return fail3('busy', '장기 채집 중에는 물건을 만들 수 없다.');
      if (s.location !== 'camp') return fail3('not_workshop', '거점의 공방에서만 물건을 만들 수 있다.');
      const pv = this.goodsPreview(id);
      if (!pv.ok) return fail3('cannot', pv.reason);
      Object.keys(pv.pick).forEach(function (k) {
        s.herbs[k] -= pv.pick[k];
        if (s.herbs[k] <= 0) delete s.herbs[k];
      });
      s.goods[id] = (s.goods[id] || 0) + 1;
      s.made[id] = (s.made[id] || 0) + 1;
      const xp = 2 + Math.floor(g.price / 60);
      const lv = this.addXp(xp);
      return { ok: true, id: id, name: g.name, used: pv.pick, xp: xp, levelsGained: lv,
        message: g.name + '을(를) 만들었다. (경험치 +' + xp + ')' };
    }

    // ------------------------------------------------------------ 거점
    rest() {
      this._rollDay();
      const s = this.state, t = this.config.today();
      if (s.location !== 'camp') return fail3('not_here', '거점에서만 쉴 수 있다.');
      if (s.phase !== 'idle') return fail3('busy', '장기 채집 중에는 쉴 수 없다.');
      if (s.restDate === t) return fail3('rested', '오늘은 이미 푹 쉬었다. 내일 다시 쉬자.');
      s.restDate = t;
      const before = s.distracted;
      s.distracted = Math.max(0, before - 1);
      return { ok: true, removed: before - s.distracted,
        message: before - s.distracted ? '따뜻한 차를 마시며 쉬었다. 흐트러짐이 한 층 가라앉았다.' : '따뜻한 차를 마시며 쉬었다. 마음이 한결 편하다.' };
    }

    // ------------------------------------------------------------ 거래소
    _baseValue(kind, id) {
      if (kind === 'item') return this.herbs[id].price;
      if (kind === 'potion') return this.ensurePotion(id).price;
      return this.goodPrice(id);
    }

    hotKeys() {
      const t = this.config.today();
      if (this._hot && this._hot.t === t) return this._hot.keys;
      const keys = [];
      this.herbList.forEach(function (h) { if (h.rarity !== 'legendary') keys.push('item:' + h.id); });
      GOODS.forEach(function (g) { keys.push('good:' + g.id); });
      keys.sort(function (a, b) { return hash(t + '#' + a) - hash(t + '#' + b); });
      this._hot = { t: t, keys: keys.slice(0, 6) };
      return this._hot.keys;
    }

    hotList() {
      return this.hotKeys().map(function (k) {
        const p = k.split(':');
        return { kind: p[0], id: p[1], name: p[0] === 'item' ? this.herbs[p[1]].name : this.goodDefs[p[1]].name };
      }, this);
    }

    _unitPrice(kind, id, soldN) {
      const key = kind + ':' + id;
      const factor = 0.8 + 0.5 * hash(this.config.today() + '|' + key);
      const hot = this.hotKeys().indexOf(key) >= 0 ? 1.5 : 1;
      const slump = 1 - Math.min(0.5, soldN * 0.04);
      return Math.max(1, Math.round(this._baseValue(kind, id) * factor * hot * slump));
    }

    priceInfo(kind, id) {
      const key = kind + ':' + id;
      const base = this._baseValue(kind, id);
      const price = this._unitPrice(kind, id, this.state.sold[key] || 0);
      return { price: price, base: base, hot: this.hotKeys().indexOf(key) >= 0, ratio: price / base };
    }

    sell(kind, id, n) {
      this._rollDay();
      const s = this.state;
      if (s.location !== 'market') return fail3('not_here', '중앙 거래소에서만 팔 수 있다.');
      const store = kind === 'item' ? s.herbs : kind === 'potion' ? s.potions : s.goods;
      const have = store[id] || 0;
      if (have < 1) return fail3('none', '팔 물건이 없다.');
      n = Math.max(1, Math.min(n || 1, have));
      const key = kind + ':' + id;
      let total = 0;
      for (let i = 0; i < n; i++) {
        total += this._unitPrice(kind, id, s.sold[key] || 0);
        s.sold[key] = (s.sold[key] || 0) + 1;
      }
      store[id] = have - n;
      if (store[id] <= 0) delete store[id];
      s.gold += total;
      const name = kind === 'item' ? this.herbs[id].name : kind === 'potion' ? this.ensurePotion(id).name : this.goodDefs[id].name;
      return { ok: true, name: name, n: n, total: total, message: name + ' ×' + n + '을(를) 팔아 ' + total + ' G를 받았다.' };
    }

    shopStock() {
      const t = this.config.today();
      const ids = this.herbList.filter(function (h) { return h.rarity !== 'legendary'; })
        .sort(function (a, b) { return hash(t + '$' + a.id) - hash(t + '$' + b.id); })
        .slice(0, 14).sort(function (a, b) {
          return A.RARITIES.indexOf(a.rarity) - A.RARITIES.indexOf(b.rarity) || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat);
        });
      return ids.map(function (h) {
        return { id: h.id, price: Math.ceil(h.price * 2.6), left: Math.max(0, 5 - (this.state.bought[h.id] || 0)) };
      }, this);
    }

    buy(id, n) {
      this._rollDay();
      const s = this.state;
      if (s.location !== 'market') return fail3('not_here', '중앙 거래소에서만 살 수 있다.');
      const item = this.shopStock().find(function (x) { return x.id === id; });
      if (!item) return fail3('no_stock', '오늘은 팔지 않는 재료다.');
      n = Math.max(1, Math.min(n || 1, item.left));
      if (item.left < 1) return fail3('sold_out', '오늘 물량이 모두 팔렸다.');
      const total = item.price * n;
      if (s.gold < total) return fail3('gold', '금화가 모자란다. (' + total + ' G 필요)');
      s.gold -= total;
      s.bought[id] = (s.bought[id] || 0) + n;
      s.herbs[id] = (s.herbs[id] || 0) + n;
      this.markSeen();
      return { ok: true, name: this.herbs[id].name, n: n, total: total, message: this.herbs[id].name + ' ×' + n + '을(를) ' + total + ' G에 샀다.' };
    }
  }

  function fail3(code, message) { return { ok: false, code: code, message: message }; }

  // ---------------------------------------------------------------- 데이터 조립
  A.createGame = function (DATA, opts) {
    const herbs = DATA.herbs.herbs.map(function (h) {
      const x = Object.assign({ cat: '약' }, h);
      x.price = itemPrice(x.rarity, x.cat, x.id);
      return x;
    });
    const regions = JSON.parse(JSON.stringify(DATA.regions.regions));
    regions.push(JSON.parse(JSON.stringify(FOREST)));
    const names = {};
    herbs.forEach(function (h) { names[h.name] = true; });
    let n = 0;
    regions.forEach(function (r) {
      r.areas.forEach(function (a) {
        (ITEMS_SRC[a.id] || []).forEach(function (row) {
          const parts = row.split(' '), name = parts[0], tok = parts[1];
          if (names[name]) throw new Error('재료 이름이 겹칩니다: ' + name);
          names[name] = true;
          const cat = tok.charAt(0), rarity = RARS[Number(tok.charAt(1)) - 1];
          const traits = [TCH[tok.charAt(2)], TCH[tok.charAt(3)]];
          if (!CATS[cat] || !rarity || !traits[0] || !traits[1]) throw new Error('재료 표기가 잘못되었습니다: ' + row);
          n += 1;
          const id = 'i' + String(n).padStart(3, '0');
          herbs.push({
            id: id, name: name, rarity: rarity, cat: cat, traits: traits, element: '', habitat: a.name,
            homeArea: a.id, areas: [a.id], price: itemPrice(rarity, cat, id),
            effect: '기운: ' + traits.join('·'),
            lore: r.name + '의 ' + a.name + '에서 얻는 ' + CATS[cat] + '.',
          });
          a.herbs.push(id);
          if (a.signatureName === name) a.signature = id;
        });
      });
    });
    // 전설 재료 추가: 대지역마다 특산 전설 재료 하나가 그 지역 모든 소지역의 재료 목록에 들어간다
    NEW_LEGENDS.forEach(function (l) {
      if (names[l.name]) throw new Error('재료 이름이 겹칩니다: ' + l.name);
      names[l.name] = true;
      herbs.push(Object.assign({ homeArea: null, areas: [], price: itemPrice('legendary', l.cat, l.id) }, l));
    });
    regions.forEach(function (r) {
      const id = REGION_LEGEND[r.id];
      if (id) r.areas.forEach(function (a) { if (a.herbs.indexOf(id) < 0) a.herbs.push(id); });
    });
    // 계절 한정 재료: season 표시가 붙고, 엔진이 지금 계절에 맞는 것만 지역 재료 목록에 보여 준다
    let sn = 0;
    SEASONAL.forEach(function (g) {
      g.items.forEach(function (row) {
        const parts = row.split(' '), name = parts[0], tok = parts[1];
        if (names[name]) throw new Error('재료 이름이 겹칩니다: ' + name);
        names[name] = true;
        const cat = tok.charAt(0), rarity = RARS[Number(tok.charAt(1)) - 1];
        const traits = [TCH[tok.charAt(2)], TCH[tok.charAt(3)]];
        if (!CATS[cat] || !rarity || !traits[0] || !traits[1]) throw new Error('재료 표기가 잘못되었습니다: ' + row);
        sn += 1;
        const id = 's' + String(sn).padStart(2, '0');
        herbs.push({ id: id, name: name, rarity: rarity, cat: cat, traits: traits, element: '', habitat: '계절 한정', homeArea: null, areas: g.areas.slice(),
          season: g.season, price: itemPrice(rarity, cat, id), effect: '기운: ' + traits.join('·'),
          lore: ({ spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' })[g.season] + '에만 얻을 수 있는 ' + CATS[cat] + '.' });
        regions.forEach(function (r) { r.areas.forEach(function (a) { if (g.areas.indexOf(a.id) >= 0) a.herbs.push(id); }); });
      });
    });
    regions.push(JSON.parse(JSON.stringify(HUB)));
    return new (A.GameClass || Game3)(Object.assign({ herbs: herbs, potions: DATA.potions.potions, regions: regions }, opts || {}));
  };

  A.Game3 = Game3;
  A.itemPrice = itemPrice;
  A.TRAITS = TRAITS;
  A.CATS = CATS;
  A.CAT_ORDER = CAT_ORDER;
  A.TOOLS = TOOLS;
  A.GOODS = GOODS;
  A.TOOL_FX = TOOL_FX;
  A.ptEffect = ptEffect;
  A.PRI_NOUN = PRI_NOUN;
  A.SEC_ADJ = SEC_ADJ;
})();
