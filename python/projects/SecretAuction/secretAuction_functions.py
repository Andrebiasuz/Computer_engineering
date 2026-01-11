import os

def clear_screen():
    # Clear the screen for Windows
    if os.name == 'nt':  # 'nt' means Windows
        os.system('cls')
    else:  # For macOS and Linux
        os.system('clear')