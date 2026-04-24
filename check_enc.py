import os

def check_encoding(file_path):
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        content.decode('utf-8')
        return 'utf-8'
    except UnicodeDecodeError:
        try:
            content.decode('cp949')
            return 'cp949'
        except UnicodeDecodeError:
            return 'unknown'

src_dir = 'src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.jsx', '.js', '.css', '.html', '.md')):
            full_path = os.path.join(root, file)
            enc = check_encoding(full_path)
            if enc != 'utf-8':
                print(f'{full_path}: {enc}')
