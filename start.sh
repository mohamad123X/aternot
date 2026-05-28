#!/bin/bash

# 1. تشغيل بوت الديسكورد في الخلفية (علامة & تعني عدم حظر السيرفر)
python bot.py &

# 2. تشغيل لوحة خادم الويب FastAPI في الواجهة الأمامية وربطها بالمنفذ الديناميكي لـ Railway
uvicorn dashboard:app --host 0.0.0.0 --port $PORT
