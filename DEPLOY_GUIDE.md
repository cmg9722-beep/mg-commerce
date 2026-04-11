# MG E-COMMERCE 클라우드 배포 가이드

## PythonAnywhere 무료 배포 (5분이면 완료!)

### 1단계: 가입
1. https://www.pythonanywhere.com 접속
2. "Start running Python online" 클릭
3. **Beginner (Free)** 선택하여 가입
4. 아이디 예: `mgcommerce` → 사이트 주소가 `mgcommerce.pythonanywhere.com`이 됩니다

### 2단계: 파일 업로드
1. 로그인 후 **Files** 탭 클릭
2. **Upload a file** 버튼으로 아래 파일들을 업로드:
   - app.py
   - config.py
   - wsgi.py
   - requirements.txt
3. **directories** 입력란에 `modules` 입력 후 **New directory** 클릭
4. modules 폴더 들어가서 아래 파일 업로드:
   - __init__.py
   - database.py
   - exchange_rate.py
   - margin_calc.py
   - supplier_mgr.py
   - message_gen.py
   - product_finder.py
   - coupang_helper.py
   - pipeline.py
5. 상위로 돌아가서 `templates` 폴더 생성 후:
   - index.html
   - homepage.html
6. `static` 폴더 생성 후:
   - app.js
   - style.css
   - manifest.json
   - sw.js
7. `data` 폴더 생성 (빈 폴더, DB가 자동 생성됨)

### 3단계: 가상환경 + 패키지 설치
1. **Consoles** 탭 → **Bash** 클릭
2. 아래 명령어 입력:
```
mkvirtualenv mgcommerce --python=/usr/bin/python3.10
pip install flask requests
```

### 4단계: 웹앱 설정
1. **Web** 탭 클릭
2. **Add a new web app** 클릭
3. **Manual configuration** 선택 → **Python 3.10** 선택
4. 설정 화면에서:
   - **Source code**: `/home/mgcommerce/` (본인 아이디로)
   - **Working directory**: `/home/mgcommerce/`
   - **Virtualenv**: `/home/mgcommerce/.virtualenvs/mgcommerce`
5. **WSGI configuration file** 클릭해서 내용을 아래로 교체:
```python
import sys
import os

project_home = '/home/mgcommerce'  # 본인 아이디로 변경
if project_home not in sys.path:
    sys.path.insert(0, project_home)

from app import app as application
from modules.database import init_db, seed_initial_data
from modules.pipeline import init_pipeline_for_product
from modules.database import get_db

init_db()
seed_initial_data()
conn = get_db()
products = conn.execute("SELECT id FROM products").fetchall()
conn.close()
for p in products:
    init_pipeline_for_product(p["id"])
```
6. **Static files** 섹션에 추가:
   - URL: `/static/` → Directory: `/home/mgcommerce/static`

### 5단계: 완료!
1. **Reload** 버튼 클릭
2. `https://mgcommerce.pythonanywhere.com` 접속!
3. 관리자: `https://mgcommerce.pythonanywhere.com/admin`

### 폰에서 앱처럼 설치
1. 폰 브라우저로 `https://mgcommerce.pythonanywhere.com/admin` 접속
2. **홈 화면에 추가** (iPhone: 공유버튼→홈화면에 추가 / Android: 메뉴→홈화면에 추가)
3. 앱 아이콘이 생기고, 앱처럼 실행됩니다!

## 무료 플랜 제한
- 월 트래픽 제한 있지만 개인 사업 수준이면 충분
- 3개월마다 한번 로그인해서 "Reload" 눌러야 유지됨
- 커스텀 도메인은 유료 ($5/월)
