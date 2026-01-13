
import csv
import sys

def get_role_category(role_str):
    if "Athens" in role_str:
        return "Athens"
    if "North America" in role_str:
        return "North America"
    if "Mars Colony" in role_str:
        return "Mars Colony"
    return "Other"

def analyze_comprehensive_discrepancies():
    summary_file = 'logsAnalysis/summaryLogsPilot.csv'
    ingame_file = 'logsAnalysis/ingameLogsPilot.csv'
    excluded_users = {'yoav@tau.ac.il', 'yoni_levy@tau.ac.il'}
    
    # 1. Classify users from summary
    users_summary_roles = {}
    
    try:
        with open(summary_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = row['userId']
                if not uid or uid in excluded_users:
                    continue
                role = get_role_category(row['role'])
                if role != "Other":
                    if uid not in users_summary_roles:
                        users_summary_roles[uid] = set()
                    users_summary_roles[uid].add(role)
    except FileNotFoundError:
        print(f"Error: File {summary_file} not found.")
        sys.exit(1)

    # Categories
    athens_na_only = set() # Has Athens + NA, missing Mars
    athens_mars_only = set() # Has Athens + Mars, missing NA
    no_athens = set() # Has NA or Mars, but NO Athens

    for uid, roles in users_summary_roles.items():
        if "Athens" in roles:
            if "North America" in roles and "Mars Colony" not in roles:
                athens_na_only.add(uid)
            elif "North America" not in roles and "Mars Colony" in roles:
                athens_mars_only.add(uid)
        else:
            # Does not have Athens, check if they have others
            if "North America" in roles or "Mars Colony" in roles:
                no_athens.add(uid)

    print(f"DEBUG: Found {len(athens_na_only)} users with Athens+NA (missing Mars) in summary.")
    print(f"DEBUG: Found {len(athens_mars_only)} users with Athens+Mars (missing NA) in summary.")
    print(f"DEBUG: Found {len(no_athens)} users with NO Athens (but other roles) in summary.")

    # 2. Check in-game logs
    
    # Storage for findings
    found_mars_for_athens_na = {} # uid -> set of roles found (should contain Mars)
    found_na_for_athens_mars = {} # uid -> set of roles found (should contain NA)
    found_roles_for_no_athens = {} # uid -> set of ALL roles found
    
    try:
        with open(ingame_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = row['userId']
                if not uid: continue
                
                role_val = row.get('role', '')
                
                # Check Athens+NA users for Mars
                if uid in athens_na_only:
                    if "Mars Colony" in role_val:
                        if uid not in found_mars_for_athens_na: found_mars_for_athens_na[uid] = set()
                        found_mars_for_athens_na[uid].add("Mars Colony")
                
                # Check Athens+Mars users for NA
                if uid in athens_mars_only:
                    if "North America" in role_val:
                        if uid not in found_na_for_athens_mars: found_na_for_athens_mars[uid] = set()
                        found_na_for_athens_mars[uid].add("North America")

                # Check No Athens users for ANY roles
                if uid in no_athens:
                    found_role = None
                    if "Athens" in role_val: found_role = "Athens"
                    elif "North America" in role_val: found_role = "North America"
                    elif "Mars Colony" in role_val: found_role = "Mars Colony"
                    
                    if found_role:
                        if uid not in found_roles_for_no_athens: found_roles_for_no_athens[uid] = set()
                        found_roles_for_no_athens[uid].add(found_role)
                        
    except FileNotFoundError:
        print(f"Error: File {ingame_file} not found.")
        sys.exit(1)

    # 3. Print Report
    print("\n## Comprehensive Discrepancy Analysis Results\n")
    
    # 3a. Athens + North America users (checking for Mars)
    print(f"### Users with 'Athens + North America' in Summary (Total: {len(athens_na_only)})")
    if found_mars_for_athens_na:
        print("Found in-game 'Mars Colony' logs for:")
        for uid in sorted(found_mars_for_athens_na.keys()):
            print(f"- **{uid}**")
    else:
        print("No in-game 'Mars Colony' logs found for these users.")

    # 3b. Athens + Mars users (checking for North America)
    print(f"\n### Users with 'Athens + Mars Colony' in Summary (Total: {len(athens_mars_only)})")
    if found_na_for_athens_mars:
        print("Found in-game 'North America' logs for:")
        for uid in sorted(found_na_for_athens_mars.keys()):
            print(f"- **{uid}**")
    else:
        print("No in-game 'North America' logs found for these users.")

    # 3c. No Athens users (checking for anything)
    print(f"\n### Users with NO 'Athens' in Summary (Total: {len(no_athens)})")
    if found_roles_for_no_athens:
        for uid in sorted(found_roles_for_no_athens.keys()):
            roles = sorted(list(found_roles_for_no_athens[uid]))
            roles_str = ", ".join(roles)
            print(f"- **{uid}**")
            print(f"  - In-Game Logs Found: {roles_str}")
    else:
        print("No in-game logs found for these users (or no standard roles matched).")

if __name__ == "__main__":
    analyze_comprehensive_discrepancies()
