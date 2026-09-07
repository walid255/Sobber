<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\MedicationController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\TimetableController;

/*
|--------------------------------------------------------------------------
| SerenityCare Recovery House REST API Routes (Laravel 11)
|--------------------------------------------------------------------------
| Compatible with the Single Page Application frontend.
*/

Route::prefix('v1')->group(function () {

    // 1. Authentication & Staff RBAC
    Route::post('/login', [PatientController::class, 'login']);
    Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
        return $request->user();
    });

    // 2. Patient / Resident Registry
    Route::apiResource('patients', PatientController::class);
    Route::post('patients/batch-import', [PatientController::class, 'batchImport']);
    Route::post('patients/{id}/progress-notes', [PatientController::class, 'addProgressNote']);
    Route::post('patients/{id}/vitals', [PatientController::class, 'addVitalRecord']);
    Route::post('patients/{id}/qualify-graduation', [PatientController::class, 'qualifyGraduation']);

    // 3. Medication Administration Record (MAR) & Prescriptions
    Route::get('mar/schedule', [MedicationController::class, 'todaySchedule']);
    Route::post('mar/administer', [MedicationController::class, 'administerDose']);
    Route::apiResource('prescriptions', MedicationController::class);

    // 4. Facility Store & Pharmacy Inventory
    Route::apiResource('inventory', InventoryController::class);
    Route::post('inventory/{id}/transaction', [InventoryController::class, 'recordTransaction']);
    Route::get('inventory/audit-report', [InventoryController::class, 'auditReport']);

    // 5. Recovery Timetable & Routine Planner
    Route::apiResource('timetable', TimetableController::class);
});
