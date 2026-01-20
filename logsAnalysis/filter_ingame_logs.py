
import csv
import sys
from datetime import datetime

# Logic to identify the 33 valid users from summaryLogsPilot.csv
def get_valid_users():
    csv_file = 'logsAnalysis/summaryLogsPilot.csv'
    valid_users = set()
    excluded_users = {'yoav@tau.ac.il', 'yoni_levy@tau.ac.il'}
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id = row['userId']
                role_raw = row['role']
                
                if not user_id:
                    continue
                
                if user_id in excluded_users:
                    continue

                # The previous analysis identified 33 users. 
                # These were just ALL users in the summary file minus the 2 excluded ones.
                # The analysis script essentially just collected all unique filtered userIds.
                # It classified them, but the "Unique User IDs" list contained everyone who passed the filter.
                valid_users.add(user_id)
                
    except FileNotFoundError:
        print(f"Error: File {csv_file} not found.")
        sys.exit(1)
        
    return valid_users

def filter_ingame_logs():
    input_file = 'logsAnalysis/ingameLogsPilot.csv'
    # We will overwrite the file, so let's read it all into memory first or write to a temp file then move.
    # Given the file size (~13MB), memory is fine.
    
    valid_users = get_valid_users()
    print(f"Identified {len(valid_users)} valid users.")
    
    kept_rows = []
    header = []
    
    removed_count = 0
    total_count = 0
    
    min_ts = None
    max_ts = None
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames
            
            for row in reader:
                total_count += 1
                uid = row['userId']
                
                if uid in valid_users:
                    kept_rows.append(row)
                    
                    # Track dates
                    ts_str = row['timestamp']
                    # Timestamp format in previous output looked like ISO isoformat or similar? 
                    # Let's assume standard ISO or parse carefully.
                    # Previous output sample for summaryLogsPilot didn't show the timestamp value clearly, 
                    # assuming it's a standard string.
                    # We'll try parsing as generic ISO. 
                    # If it fails, we might treat it as string for sorting, but prompt asks for "Dates".
                    try:
                        # Attempt to handle common formats
                        # Example: 2024-11-20T10:00:00.00Z
                        ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                        
                        if min_ts is None or ts < min_ts:
                            min_ts = ts
                        if max_ts is None or ts > max_ts:
                            max_ts = ts
                    except ValueError:
                        pass # Ignore if format is weird
                else:
                    removed_count += 1
                    
    except FileNotFoundError:
        print(f"Error: File {input_file} not found.")
        return

    # Overwrite the file
    with open(input_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(kept_rows)
        
    print(f"Total rows processed: {total_count}")
    print(f"Rows removed: {removed_count}")
    print(f"Rows retained: {len(kept_rows)}")
    
    if min_ts and max_ts:
        print(f"Date Range: {min_ts.date()} to {max_ts.date()}")
    else:
        print("Date Range: Could not determine (timestamps missing or unparsable)")

if __name__ == "__main__":
    filter_ingame_logs()
