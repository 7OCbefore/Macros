import sys
import re

def analyze_logs(log_content):
    patterns = {
        r"TypeError:.*null": "Null Reference: Check if Player or World object is initialized.",
        r"ConcurrentModificationException": "Java Sync Issue: You are modifying a collection while iterating it.",
        r"Script timed out": "Performance Issue: Loop missing Client.waitTick() or complex regex on main thread.",
        r"Invalid rotation": "Anti-Cheat: Use MovementService.smoothLookAt instead of direct lookAt.",
        r"Container is closed": "Sync Issue: Menu closed unexpectedly. Add Hud.isContainer() checks."
    }

    found = False
    for pattern, advice in patterns.items():
        if re.search(pattern, log_content, re.IGNORECASE):
            print(f"DIAGNOSIS: {advice}")
            found = True
    
    if not found:
        print("DIAGNOSIS: No common patterns identified. Check stack trace manually.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python log_checker.py <log_text>")
    else:
        analyze_logs(sys.argv[1])
