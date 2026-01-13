
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

def analyze_logs():
    csv_file = 'logsAnalysis/summaryLogsPilot.csv'
    users_roles = {}
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id = row['userId']
                role_raw = row['role']
                
                if not user_id:
                    continue
                
                # Filter out specific users
                if user_id in ['yoav@tau.ac.il', 'yoni_levy@tau.ac.il']:
                    continue
                    
                role = get_role_category(role_raw)
                
                if user_id not in users_roles:
                    users_roles[user_id] = set()
                
                if role != "Other":
                    users_roles[user_id].add(role)

    except FileNotFoundError:
        print(f"Error: File {csv_file} not found.")
        return

    unique_ids = sorted(list(users_roles.keys()))
    
    # Categories
    all_three = 0
    only_athens = 0
    athens_na_only = 0
    na_or_mars_no_athens = 0
    
    # New buckets for missing flows
    athens_mars_only = 0
    no_valid_roles = 0
    
    print("# Analysis of User Logs\n")
    
    # Print Unique Users List
    print("## Unique User IDs")
    for uid in unique_ids:
        # We need to apply the same filter here or filter the list earlier
        if uid in ['yoav@tau.ac.il', 'yoni_levy@tau.ac.il']:
            continue
        print(f"- {uid}")
    
    print("\n## User Classification Details")

    for uid in unique_ids:
        roles = users_roles[uid]
        
        has_athens = "Athens" in roles
        has_na = "North America" in roles
        has_mars = "Mars Colony" in roles
        
        classified = False
        
        if len(roles) == 0:
            no_valid_roles += 1
            print(f"- **{uid}**: No valid roles (Only 'Other' e.g. Tel Aviv)")
            classified = True

        elif has_athens and has_na and has_mars:
            all_three += 1
            classified = True
        elif has_athens and len(roles) == 1:
            only_athens += 1
            classified = True
        elif has_athens and has_na and not has_mars:
            athens_na_only += 1
            classified = True
        elif (has_na or has_mars) and not has_athens:
            na_or_mars_no_athens += 1
            classified = True
        elif has_athens and has_mars and not has_na:
            athens_mars_only += 1
            print(f"- **{uid}**: Athens + Mars (Missing North America)")
            classified = True
            
        if not classified:
             print(f"- **{uid}**: UNCLASSIFIED - Roles: {roles}")

    print("\n## Updated Completion Statistics")
    print(f"- **Total Unique Users**: {len(unique_ids)}")
    print(f"- **Finished all 3 roles**: {all_three}")
    print(f"- **Finished ONLY Athens**: {only_athens}")
    print(f"- **Finished Athens and North America (No Mars)**: {athens_na_only}")
    print(f"- **Finished Athens and Mars (No North America)**: {athens_mars_only}")
    print(f"- **Finished North America OR Mars WITHOUT Athens**: {na_or_mars_no_athens}")
    print(f"- **No valid roles (e.g. only Tel Aviv)**: {no_valid_roles}")

if __name__ == "__main__":
    analyze_logs()
