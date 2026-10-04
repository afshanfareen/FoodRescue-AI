import sys
sys.path.insert(0, r'c:\Users\afsha\PROJECT\foodrescue-ai\backend')
try:
    import app.main
    print('IMPORT OK')
except Exception as e:
    print('IMPORT ERROR:', e)
    import traceback
    traceback.print_exc()
