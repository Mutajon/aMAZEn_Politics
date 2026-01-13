
import csv
import sys

def verify_all():
    summary_file = 'logsAnalysis/summaryLogsPilot.csv'
    ingame_file = 'logsAnalysis/ingameLogsPilot.csv'
    excluded_users = {'yoav@tau.ac.il', 'yoni_levy@tau.ac.il'}
    
    # 1. Collect all distinct roles in ingame logs to ensure we aren't missing pattern matches
    distinct_ingame_roles = set()
    try:
        with open(ingame_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                r = row.get('role', '')
                if r:
                    distinct_ingame_roles.add(r)
    except FileNotFoundError:
        print("Ingame file not found")
        sys.exit(1)
        
    print("Distinct roles found in ingame logs:")
    for r in sorted(list(distinct_ingame_roles)):
        print(f"  '{r}'")
    print("-" * 40)

    # 2. Re-identify Athens Only users
    users_summary_roles = {}
    with open(summary_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            uid = row['userId']
            if not uid or uid in excluded_users:
                continue
            r = row['role']
            role_type = "Other"
            if "Athens" in r: role_type = "Athens"
            elif "North America" in r: role_type = "North America"
            elif "Mars Colony" in r: role_type = "Mars Colony"
            
            if role_type != "Other":
                if uid not in users_summary_roles:
                    users_summary_roles[uid] = set()
                users_summary_roles[uid].add(role_type)
                
    athens_only = []
    for uid, roles in users_summary_roles.items():
        if "Athens" in roles and "North America" not in roles and "Mars Colony" not in roles:
            athens_only.append(uid)
            
    athens_only.sort()
    print(f"Verified 'Athens Only' users (Count: {len(athens_only)}):")
    for u in athens_only:
        print(f"  {u}")
    print("-" * 40)

    # 3. Check specific logs for these users
    # Searching for substring matches again, but now printed to be sure
    users_with_extra_logs = {}
    
    with open(ingame_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            uid = row['userId']
            if uid in athens_only:
                r = row.get('role', '')
                found = []
                if "North America" in r: found.append("North America")
                if "Mars Colony" in r: found.append("Mars Colony")
                
                if found:
                    if uid not in users_with_extra_logs:
                        users_with_extra_logs[uid] = set()
                    for item in found:
                        users_with_extra_logs[uid].add(item)

    print("Discrepancy Results:")
    if not users_with_extra_logs:
        print("No users found with extra logs.")
    else:
        for uid, extras in users_with_extra_logs.items():
            print(f"User: {uid} has extra logs for: {extras}")

if __name__ == "__main__":
    verify_all()
