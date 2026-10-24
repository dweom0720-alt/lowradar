# 최저가 레이더 설치 안내

검색어 한 번으로 쿠팡·네이버·11번가·G마켓·옥션·알리·테무·무신사를 열고,
네이버 가격비교로 여러 쇼핑몰 가격을 한 화면에 모아 보는 개인용 웹앱입니다.

총 3단계, 처음 한 번만 하면 됩니다. (약 20~30분)

---

## 1단계. 네이버 검색 API 키 받기 (무료, 하루 25,000회)

1. https://developers.naver.com 접속 → 네이버 아이디로 로그인
2. 상단 **Application → 애플리케이션 등록**
3. 입력
   - 애플리케이션 이름: `최저가레이더`
   - 사용 API: **검색**
   - 비로그인 오픈 API 서비스 환경: **WEB 설정** → `https://dweom0720-alt.github.io`
4. 등록 후 화면의 **Client ID**, **Client Secret** 두 값을 메모

## 2단계. 중계서버 만들기 (Cloudflare Worker, 무료)

네이버 API는 키를 숨겨야 하고 웹페이지에서 직접 부를 수 없어서, 중간에 작은 서버를 둡니다.

1. https://dash.cloudflare.com 무료 가입 → 로그인
2. 왼쪽 **Workers & Pages → Create → Worker** → 이름 `shop-proxy` → **Deploy**
3. **Edit code** → 기존 코드를 모두 지우고 `worker.js` 내용을 붙여넣기 → **Deploy**
4. Worker 화면 **Settings → Variables and Secrets → Add**
   - `NAVER_ID` (Type: Secret) = 1단계 Client ID
   - `NAVER_SECRET` (Type: Secret) = 1단계 Client Secret
   - 저장 후 **Deploy**
5. 확인: 브라우저에서 `https://shop-proxy.<내계정>.workers.dev/?query=생수` 를 열어
   상품 목록(글자 가득한 JSON)이 보이면 성공

## 3단계. 웹앱 올리기 (GitHub Pages)

1. https://github.com 로그인 → **New repository** → 이름 `lowradar` → Public → Create
2. **Add file → Upload files** 로 아래 파일 업로드 → Commit
   - `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`
3. **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save
4. 1~2분 뒤 주소: `https://dweom0720-alt.github.io/lowradar/`

## 마무리. 앱 연결과 설치

1. 위 주소 열기 → 아래 **설정** 탭 → 중계서버 주소에 `https://shop-proxy.<내계정>.workers.dev` 입력
   → **저장하고 연결 확인** → "✓ 연결됐습니다"
2. 폴드8 크롬 메뉴(⋮) → **홈 화면에 추가 → 설치**
3. 이제 쿠팡·네이버 앱에서 상품을 **공유 → 최저가 레이더** 하면 상품명으로 바로 검색됩니다

---

## 기능 요약

| 기능 | 쓰는 법 |
|---|---|
| 사이트별 바로 열기 | 검색 후 사이트 버튼 탭 → 그 사이트 검색 결과 |
| 최저가 목록 | 네이버 가격비교 결과, 정렬(정확도·낮은가격·높은가격·최신), 최저가 노란 표시 |
| 찜 + 가격 기록 | ♡ 누르면 그날 가격 저장, **가격 새로고침**마다 날짜별 기록·그래프 |
| 목표가 알림 | 찜 카드에 목표가 입력 → 그 가격 이하가 되면 "목표가 도달" 표시 |
| 자동 갱신 | 앱을 하루 처음 열 때 찜 가격 자동 확인 (설정에서 끄기 가능) |
| 직접 찜 | 쿠팡·알리 등 목록에 없는 상품은 이름·가격을 직접 입력해 기록 |
| 최근 검색·자주 사는 품목 | 검색어 칩, ☆ 눌러 즐겨찾기 |
| 사이트 설정 | 켜기·끄기·순서 변경, 해외직구·중고 제외 |
| 백업 | 폰↔탭 옮길 때 백업 파일 저장·불러오기 |
| 화면 | 접은 화면은 탭 1열, 펼친 화면·탭은 검색 | 찜 2열 |

## 알아둘 점

- 최저가 목록은 **네이버 가격비교에 들어온 쇼핑몰** 기준입니다. 쿠팡 일부 상품·알리·테무는 빠질 수 있어 사이트 버튼으로 함께 확인하세요.
- 표시 가격은 **배송비 별도**입니다(네이버 API가 배송비를 주지 않음).
- 찜 기록은 기기마다 따로 저장됩니다. 다른 기기로 옮길 땐 백업 기능을 쓰세요.
