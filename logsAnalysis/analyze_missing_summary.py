
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

def analyze_discrepancies():
    summary_file = 'logsAnalysis/summaryLogsPilot.csv'
    ingame_file = 'logsAnalysis/ingameLogsPilot.csv'
    
    excluded_users = {'yoav@tau.ac.il', 'yoni_levy@tau.ac.il'}
    
    # Step 1: Identify "Athens Only" users from summary
    users_summary_roles = {}
    
    try:
        with open(summary_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id = row['userId']
                if not user_id or user_id in excluded_users:
                    continue
                    
                role = get_role_category(row['role'])
                if role != "Other":
                    if user_id not in users_summary_roles:
                        users_summary_roles[user_id] = set()
                    users_summary_roles[user_id].add(role)
                    
    except FileNotFoundError:
        print(f"Error: File {summary_file} not found.")
        sys.exit(1)

    athens_only_users = set()
    for uid, roles in users_summary_roles.items():
        # User defined "Athens Only" as having Athens but NOT North America AND NOT Mars in summary
        if "Athens" in roles and "North America" not in roles and "Mars Colony" not in roles:
            athens_only_users.add(uid)

    print(f"DEBUG: Found {len(athens_only_users)} users with ONLY Athens in summary logs.")

    # Step 2: Check in-game logs for these users
    # We look for ANY log where role contains "North America" or "Mars"
    
    discrepancies = {} # uid -> set of extra roles found
    
    try:
        with open(ingame_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id = row['userId']
                # Only check identified "Athens Only" users
                if user_id not in athens_only_users:
                    continue
                    
                role_val = row.get('role', '')
                found_role = None
                
                # Check if this log entry belongs to a role they shouldn't generally have based on summary
                if "North America" in role_val:
                    found_role = "North America"
                elif "Mars Colony" in role_val:
                    found_role = "Mars Colony"
                
                if found_role:
                    if user_id not in discrepancies:
                        discrepancies[user_id] = set()
                    discrepancies[user_id].add(found_role)
                    
    except FileNotFoundError:
        print(f"Error: File {ingame_file} not found.")
        sys.exit(1)

    # Output Report
    print("\n## Discrepancy Analysis: Missing Summary Logs")
    print("The following users have only 'Athens' in the summary logs, but have in-game logs for later roles:\n")
    
    if not discrepancies:
        print("- No discrepancies found. All 'Athens Only' users imply they truly stopped after Athens (or no in-game logs found for later stages).")
    else:
        for uid in sorted(discrepancies.keys()):
            extra_roles = sorted(list(discrepancies[uid]))
            roles_str = ", ".join(extra_roles)
            print(f"- **{uid}**")
            print(f"  - Summary: Athens Only")
            print(f"  - In-Game Logs Found: {roles_str}")

if __name__ == "__main__":
    analyze_discrepancies()
