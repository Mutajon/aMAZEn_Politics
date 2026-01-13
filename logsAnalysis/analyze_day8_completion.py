
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

def analyze_day8_completion():
    summary_file = 'logsAnalysis/summaryLogsPilot.csv'
    ingame_file = 'logsAnalysis/ingameLogsPilot.csv'
    excluded_users = {'yoav@tau.ac.il', 'yoni_levy@tau.ac.il'}
    
    # 1. Identify Target Users and their Missing Roles from Summary
    # Mapping: userId -> set of Missing Roles to check
    targets = {} 
    
    try:
        with open(summary_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = row['userId']
                if not uid or uid in excluded_users:
                    continue
                    
                role = get_role_category(row['role'])
                
                # We need to reconstruct the user's summary profile first
                # Actually, easier to build the profile then generate targets
                if role != "Other":
                    if uid not in targets: targets[uid] = set()
                    targets[uid].add(role)
                    
    except FileNotFoundError:
        print(f"Error: File {summary_file} not found.")
        sys.exit(1)

    users_to_check = {} # uid -> set of roles we EXPECT to find Day 8 for
    
    for uid, roles in targets.items():
        missing = set()
        
        # Logic from previous analysis:
        # 1. Athens Only -> Expect NA, Mars
        if "Athens" in roles and "North America" not in roles and "Mars Colony" not in roles:
            missing.add("North America")
            missing.add("Mars Colony")
            
        # 2. Athens + NA -> Expect Mars
        elif "Athens" in roles and "North America" in roles and "Mars Colony" not in roles:
            missing.add("Mars Colony")
            
        # 3. Athens + Mars -> Expect NA
        elif "Athens" in roles and "North America" not in roles and "Mars Colony" in roles:
            missing.add("North America")
            
        # 4. No Athens -> Expect Athens (and maybe others if also missing from summary)
        elif "Athens" not in roles:
            missing.add("Athens")
            if "North America" not in roles: missing.add("North America")
            if "Mars Colony" not in roles: missing.add("Mars Colony")
            
        if missing:
            users_to_check[uid] = missing

    # 2. Scan In-Game Logs for Day 8 in the missing roles
    
    # Results: uid -> role -> matched_day_8 (boolean)
    results = {}
    
    try:
        with open(ingame_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = row['userId']
                if uid not in users_to_check:
                    continue
                
                role_val = row.get('role', '')
                day_val = row.get('day', '')
                
                # Check if this log matches a missing role
                target_roles = users_to_check[uid]
                matched_target = None
                
                if "Athens" in role_val and "Athens" in target_roles: matched_target = "Athens"
                elif "North America" in role_val and "North America" in target_roles: matched_target = "North America"
                elif "Mars Colony" in role_val and "Mars Colony" in target_roles: matched_target = "Mars Colony"
                
                if matched_target:
                    # Check for Day 8
                    if day_val == '8':
                        if uid not in results: results[uid] = {}
                        results[uid][matched_target] = True
                        
    except FileNotFoundError:
        print(f"Error: File {ingame_file} not found.")
        sys.exit(1)

    # 3. Print Report
    print("\n## Day 8 Completion Verification Results\n")
    
    # Group by category for clarity
    
    # Helper to check if verified
    def is_verified(uid, role):
        return results.get(uid, {}).get(role, False)

    # Athens Only Users (leonklempert)
    print("### 'Athens Only' Summary Users")
    found_any = False
    for uid, missing in users_to_check.items():
        # Heuristic to identify group: matches Athens Only logic
        if "North America" in missing and "Mars Colony" in missing:
            found_any = True
            print(f"- **{uid}**")
            print(f"  - North America: {'✅ Day 8 Found' if is_verified(uid, 'North America') else '❌ No Day 8 Found'}")
            print(f"  - Mars Colony:   {'✅ Day 8 Found' if is_verified(uid, 'Mars Colony') else '❌ No Day 8 Found'}")
    if not found_any: print("None found.")

    # Athens + NA (Missing Mars)
    print("\n### 'Athens + North America' Summary Users (Missing Mars)")
    found_any = False
    for uid, missing in users_to_check.items():
        if "Mars Colony" in missing and "North America" not in missing:
            found_any = True
            print(f"- **{uid}**: {'✅ Day 8 Found' if is_verified(uid, 'Mars Colony') else '❌ No Day 8 Found'}")
    if not found_any: print("None found.")

    # Athens + Mars (Missing NA)
    print("\n### 'Athens + Mars' Summary Users (Missing North America)")
    found_any = False
    for uid, missing in users_to_check.items():
        if "North America" in missing and "Mars Colony" not in missing:
            found_any = True
            print(f"- **{uid}**: {'✅ Day 8 Found' if is_verified(uid, 'North America') else '❌ No Day 8 Found'}")
    if not found_any: print("None found.")

    # No Athens
    print("\n### 'No Athens' Summary Users")
    found_any = False
    for uid, missing in users_to_check.items():
        if "Athens" in missing:
            found_any = True
            print(f"- **{uid}**")
            for m in sorted(list(missing)):
                print(f"  - {m}: {'✅ Day 8 Found' if is_verified(uid, m) else '❌ No Day 8 Found'}")

if __name__ == "__main__":
    analyze_day8_completion()
