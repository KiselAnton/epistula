"""Data export and import utilities for selective data transfer between schemas.

This module provides:
- Export entities (faculties, users, subjects, lectures, etc.) from any schema as JSON
- Import entities into a schema with merge/replace strategies
- Support for exporting from temp schemas and importing to production
"""

from __future__ import annotations

import json
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# Entity types that can be exported/imported
ENTITY_TYPES = [
    'faculties',
    'faculty_professors',
    'faculty_students',
    'subjects',
    'subject_professors',
    'lectures',
    'lecture_materials',
]


def export_entity(
    db: Session,
    schema_name: str,
    entity_type: str,
    entity_ids: Optional[List[int]] = None
) -> Dict[str, Any]:
    """Export entities from a schema as JSON.
    
    Args:
        db: Database session
        schema_name: Source schema (e.g., 'uni_1' or 'uni_1_temp')
        entity_type: Type of entity ('faculties', 'subjects', etc.)
        entity_ids: Optional list of specific IDs to export. If None, exports all.
        
    Returns:
        Dict with exported data and metadata
    """
    if entity_type not in ENTITY_TYPES:
        raise ValueError(f"Unknown entity type: {entity_type}. Must be one of {ENTITY_TYPES}")
    
    logger.info(f"[EXPORT] Exporting {entity_type} from schema {schema_name}")
    
    # Build query
    where_clause = ""
    if entity_ids:
        ids_str = ','.join(str(id) for id in entity_ids)
        where_clause = f"WHERE id IN ({ids_str})"
    
    query = text(f"SELECT * FROM {schema_name}.{entity_type} {where_clause}")
    
    result = db.execute(query)
    columns = result.keys()
    rows = result.fetchall()
    
    # Convert rows to list of dicts
    data = []
    for row in rows:
        row_dict = {}
        for col, val in zip(columns, row):
            # Handle datetime serialization
            if isinstance(val, datetime):
                row_dict[col] = val.isoformat()
            else:
                row_dict[col] = val
        data.append(row_dict)
    
    export_result = {
        "entity_type": entity_type,
        "source_schema": schema_name,
        "count": len(data),
        "exported_at": datetime.utcnow().isoformat(),
        "data": data,
        "columns": list(columns)
    }
    
    logger.info(f"[EXPORT] Exported {len(data)} {entity_type} from {schema_name}")
    
    return export_result


def export_faculty_with_relations(
    db: Session,
    schema_name: str,
    faculty_id: int
) -> Dict[str, Any]:
    """Export a faculty with all its related data (subjects, assignments, etc.).
    
    Args:
        db: Database session
        schema_name: Source schema
        faculty_id: Faculty ID to export
        
    Returns:
        Dict with faculty and all related entities
    """
    logger.info(f"[EXPORT] Exporting faculty {faculty_id} with relations from {schema_name}")
    
    # Export faculty
    faculty_data = export_entity(db, schema_name, 'faculties', [faculty_id])
    
    if not faculty_data['data']:
        raise ValueError(f"Faculty {faculty_id} not found in {schema_name}")
    
    # Export related entities
    result = {
        "export_type": "faculty_with_relations",
        "faculty_id": faculty_id,
        "source_schema": schema_name,
        "exported_at": datetime.utcnow().isoformat(),
        "faculty": faculty_data['data'][0],
        "relations": {}
    }
    
    # Get faculty professors
    profs = db.execute(
        text(f"SELECT * FROM {schema_name}.faculty_professors WHERE faculty_id = :fid"),
        {"fid": faculty_id}
    ).fetchall()
    result['relations']['faculty_professors'] = [dict(zip(['id', 'faculty_id', 'professor_id', 'assigned_at', 'assigned_by', 'is_active'], p)) for p in profs]
    
    # Get faculty students
    students = db.execute(
        text(f"SELECT * FROM {schema_name}.faculty_students WHERE faculty_id = :fid"),
        {"fid": faculty_id}
    ).fetchall()
    result['relations']['faculty_students'] = [dict(zip(['id', 'faculty_id', 'student_id', 'assigned_at', 'assigned_by', 'is_active'], s)) for s in students]
    
    # Get subjects
    subjects = db.execute(
        text(f"SELECT * FROM {schema_name}.subjects WHERE faculty_id = :fid"),
        {"fid": faculty_id}
    ).fetchall()
    
    result['relations']['subjects'] = []
    for subj in subjects:
        subj_dict = dict(zip(['id', 'faculty_id', 'name', 'code', 'description', 'created_at', 'created_by', 'updated_at', 'is_active'], subj))
        
        # Get subject professors for this subject
        subj_profs = db.execute(
            text(f"SELECT * FROM {schema_name}.subject_professors WHERE subject_id = :sid"),
            {"sid": subj_dict['id']}
        ).fetchall()
        subj_dict['professors'] = [dict(zip(['id', 'subject_id', 'professor_id', 'can_edit', 'assigned_at', 'assigned_by', 'is_active'], p)) for p in subj_profs]
        
        # Get lectures for this subject
        lectures = db.execute(
            text(f"SELECT * FROM {schema_name}.lectures WHERE subject_id = :sid ORDER BY order_number"),
            {"sid": subj_dict['id']}
        ).fetchall()
        
        lectures_list = []
        for lec in lectures:
            lec_dict = dict(zip(['id', 'subject_id', 'title', 'description', 'order_number', 'created_at', 'created_by', 'updated_at', 'is_active'], lec))
            
            # Get lecture materials
            materials = db.execute(
                text(f"SELECT * FROM {schema_name}.lecture_materials WHERE lecture_id = :lid ORDER BY order_number"),
                {"lid": lec_dict['id']}
            ).fetchall()
            lec_dict['materials'] = [dict(zip(['id', 'lecture_id', 'title', 'content', 'material_type', 'order_number', 'created_at', 'created_by', 'updated_at', 'is_active'], m)) for m in materials]
            
            lectures_list.append(lec_dict)
        
        subj_dict['lectures'] = lectures_list
        result['relations']['subjects'].append(subj_dict)
    
    logger.info(f"[EXPORT] Exported faculty {faculty_id} with {len(result['relations']['subjects'])} subjects")
    
    return result


def import_entity(
    db: Session,
    schema_name: str,
    entity_type: str,
    data: List[Dict[str, Any]],
    strategy: Literal['replace', 'merge', 'skip_existing'] = 'merge',
    id_mapping: Optional[Dict[int, int]] = None
) -> Dict[str, Any]:
    """Import entities into a schema.
    
    Args:
        db: Database session
        schema_name: Target schema (e.g., 'uni_1')
        entity_type: Type of entity to import
        data: List of entity dicts to import
        strategy: 
            - 'replace': Delete existing records with same ID, insert new
            - 'merge': Update existing records, insert new ones
            - 'skip_existing': Only insert new records, skip existing IDs
        id_mapping: Optional dict to remap foreign key IDs (e.g., {old_faculty_id: new_faculty_id})
        
    Returns:
        Dict with import results
    """
    if entity_type not in ENTITY_TYPES:
        raise ValueError(f"Unknown entity type: {entity_type}")
    
    logger.info(f"[IMPORT] Importing {len(data)} {entity_type} into {schema_name} (strategy: {strategy})")
    
    imported = 0
    updated = 0
    skipped = 0
    errors = []
    
    for item in data:
        try:
            # Apply ID mapping if provided (for foreign keys)
            if id_mapping:
                for key in item.keys():
                    if key.endswith('_id') and item[key] in id_mapping:
                        old_id = item[key]
                        item[key] = id_mapping[old_id]
                        logger.debug(f"[IMPORT] Remapped {key}: {old_id} → {item[key]}")
            
            # Remove auto-generated fields that shouldn't be set directly
            original_id = item.pop('id', None)
            item.pop('created_at', None)
            item.pop('updated_at', None)
            
            # Check if record exists
            if original_id and strategy in ['replace', 'merge', 'skip_existing']:
                exists = db.execute(
                    text(f"SELECT id FROM {schema_name}.{entity_type} WHERE id = :id"),
                    {"id": original_id}
                ).fetchone()
                
                if exists:
                    if strategy == 'skip_existing':
                        skipped += 1
                        logger.debug(f"[IMPORT] Skipped existing {entity_type} ID {original_id}")
                        continue
                    elif strategy == 'replace':
                        db.execute(
                            text(f"DELETE FROM {schema_name}.{entity_type} WHERE id = :id"),
                            {"id": original_id}
                        )
                        logger.debug(f"[IMPORT] Deleted existing {entity_type} ID {original_id} for replacement")
                    elif strategy == 'merge':
                        # Build UPDATE query
                        set_clause = ', '.join([f"{k} = :{k}" for k in item.keys()])
                        update_query = text(f"UPDATE {schema_name}.{entity_type} SET {set_clause} WHERE id = :id")
                        db.execute(update_query, {**item, 'id': original_id})
                        updated += 1
                        logger.debug(f"[IMPORT] Updated {entity_type} ID {original_id}")
                        continue
            
            # Insert new record
            columns = ', '.join(item.keys())
            placeholders = ', '.join([f":{k}" for k in item.keys()])
            insert_query = text(f"INSERT INTO {schema_name}.{entity_type} ({columns}) VALUES ({placeholders})")
            db.execute(insert_query, item)
            imported += 1
            logger.debug(f"[IMPORT] Inserted new {entity_type}")
            
        except IntegrityError as e:
            error_msg = f"Integrity error for {entity_type}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"[IMPORT] {error_msg}")
            db.rollback()
        except Exception as e:
            error_msg = f"Error importing {entity_type}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"[IMPORT] {error_msg}")
            db.rollback()
    
    db.commit()
    
    result = {
        "entity_type": entity_type,
        "target_schema": schema_name,
        "strategy": strategy,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "total_processed": len(data)
    }
    
    logger.info(f"[IMPORT] Completed: {imported} imported, {updated} updated, {skipped} skipped, {len(errors)} errors")
    
    return result


def import_faculty_with_relations(
    db: Session,
    schema_name: str,
    faculty_data: Dict[str, Any],
    strategy: Literal['replace', 'merge', 'skip_existing'] = 'merge'
) -> Dict[str, Any]:
    """Import a faculty with all its related data.
    
    Args:
        db: Database session
        schema_name: Target schema
        faculty_data: Faculty data dict (as exported by export_faculty_with_relations)
        strategy: Import strategy
        
    Returns:
        Dict with import results for all entities
    """
    logger.info(f"[IMPORT] Importing faculty with relations into {schema_name}")
    
    results = {
        "target_schema": schema_name,
        "strategy": strategy,
        "imported_at": datetime.utcnow().isoformat(),
        "results": {}
    }
    
    # Import faculty first
    faculty_result = import_entity(db, schema_name, 'faculties', [faculty_data['faculty']], strategy)
    results['results']['faculty'] = faculty_result
    
    # Get the faculty ID (either original or newly created)
    faculty_id = faculty_data['faculty'].get('id')
    
    # Import relations
    relations = faculty_data.get('relations', {})
    
    # Import faculty professors
    if 'faculty_professors' in relations and relations['faculty_professors']:
        results['results']['faculty_professors'] = import_entity(
            db, schema_name, 'faculty_professors', 
            relations['faculty_professors'], strategy
        )
    
    # Import faculty students
    if 'faculty_students' in relations and relations['faculty_students']:
        results['results']['faculty_students'] = import_entity(
            db, schema_name, 'faculty_students',
            relations['faculty_students'], strategy
        )
    
    # Import subjects with their professors and lectures
    if 'subjects' in relations:
        for subject in relations['subjects']:
            # Extract nested data
            subject_profs = subject.pop('professors', [])
            lectures = subject.pop('lectures', [])
            
            # Import subject
            subj_result = import_entity(db, schema_name, 'subjects', [subject], strategy)
            
            # Import subject professors
            if subject_profs:
                import_entity(db, schema_name, 'subject_professors', subject_profs, strategy)
            
            # Import lectures with materials
            for lecture in lectures:
                materials = lecture.pop('materials', [])
                
                # Import lecture
                import_entity(db, schema_name, 'lectures', [lecture], strategy)
                
                # Import lecture materials
                if materials:
                    import_entity(db, schema_name, 'lecture_materials', materials, strategy)
        
        results['results']['subjects'] = {"message": f"Imported {len(relations['subjects'])} subjects with relations"}
    
    logger.info(f"[IMPORT] Completed faculty import with all relations")
    
    return results
