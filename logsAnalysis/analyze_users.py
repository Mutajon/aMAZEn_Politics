
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
    athens_na_only = 0 # Athens and North America (no Mars)
    na_or_mars_no_athens = 0 # (North America OR Mars) AND NOT Athens
    
    debug_counts = {"Athens": 0, "North America": 0, "Mars Colony": 0}

    for uid in unique_ids:
        roles = users_roles[uid]
        
        has_athens = "Athens" in roles
        has_na = "North America" in roles
        has_mars = "Mars Colony" in roles
        
        # Debug counts
        if has_athens: debug_counts["Athens"] += 1
        if has_na: debug_counts["North America"] += 1
        if has_mars: debug_counts["Mars Colony"] += 1

        if has_athens and has_na and has_mars:
            all_three += 1
        elif has_athens and len(roles) == 1:
            only_athens += 1
        elif has_athens and has_na and not has_mars:
            # Check if they have ANY other roles that might interfere? 
            # User said "how many have only Athens and North America" - usually implies exactly those two relevant ones.
            # But wait, my logic for "Other" roles filters them out of the set.
            # So len(roles) check is strict on the 3 relevant roles.
            # But condition is logic: "Only Athens and North America" (implies no Mars).
            # Does it imply NO other random roles if they existed?
            # My filter `get_role_category` returns "Other" which I don't add to the set.
            # So `roles` set ONLY contains the 3 target roles.
            # So `len(roles) == 2` and `has_athens` and `has_na` covers it.
            athens_na_only += 1
        
        if (has_na or has_mars) and not has_athens:
            na_or_mars_no_athens += 1

    # Output Markdown
    print("# Analysis of User Logs")
    print("\n## Unique User IDs")
    for uid in unique_ids:
        print(f"- {uid}")
        
    print("\n## Completion Statistics")
    print(f"- **Total Unique Users**: {len(unique_ids)}")
    print(f"- **Finished all 3 roles (Athens, North America, Mars Colony)**: {all_three}")
    print(f"- **Finished ONLY Athens**: {only_athens}")
    print(f"- **Finished ONLY Athens and North America (No Mars)**: {athens_na_only}")
    print(f"- **Finished North America OR Mars WITHOUT Athens**: {na_or_mars_no_athens}")

if __name__ == "__main__":
    analyze_logs()
