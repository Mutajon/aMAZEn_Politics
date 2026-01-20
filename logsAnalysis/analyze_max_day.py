
import csv
import sys

def analyze_max_day():
    ingame_file = 'logsAnalysis/ingameLogsPilot.csv'
    
    # Specific users to check map to the roles we are interested in.
    # In this case, verified from previous step: these 3 users are missing "Mars Colony" completion.
    targets = {
        'Mayajaqliner@mail.tau.ac.il': 'Mars Colony',
        'gal2@mail.tau.ac.il': 'Mars Colony',
        'noamronen2@mail.tau.ac.il': 'Mars Colony'
    }
    
    max_days = {uid: 0 for uid in targets}
    
    try:
        with open(ingame_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = row['userId']
                if uid in targets:
                    role_val = row.get('role', '')
                    day_val = row.get('day', '')
                    
                    target_role = targets[uid]
                    
                    if target_role in role_val:
                        try:
                            day_int = int(day_val)
                            if day_int > max_days[uid]:
                                max_days[uid] = day_int
                        except ValueError:
                            pass # Ignore non-integer days
                            
    except FileNotFoundError:
        print(f"Error: File {ingame_file} not found.")
        sys.exit(1)

    print("\n## Max Day Analysis for Incomplete Users\n")
    for uid in sorted(targets.keys()):
        role = targets[uid]
        day = max_days[uid]
        print(f"- **{uid}** ({role}): Max Day reached = {day}")

if __name__ == "__main__":
    analyze_max_day()
