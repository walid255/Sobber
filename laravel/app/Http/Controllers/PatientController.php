<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Patient;
use App\Models\NextOfKin;
use App\Models\PsychiatricHistory;
use App\Models\PatientVital;
use App\Models\ProgressNote;

class PatientController extends Controller
{
    /**
     * Display a listing of residents with optional stage & search filter.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Patient::with(['nextOfKin', 'psychiatricHistory', 'prescriptions', 'vitals']);

        if ($request->has('stage') && $request->stage !== 'all') {
            $query->where('stage', $request->stage);
        }

        if ($request->has('search')) {
            $q = $request->search;
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'LIKE', "%{$q}%")
                    ->orWhere('id', 'LIKE', "%{$q}%")
                    ->orWhere('room_number', 'LIKE', "%{$q}%");
            });
        }

        return response()->json($query->latest()->get());
    }

    /**
     * Store a newly admitted resident.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'dob' => 'required|date',
            'gender' => 'required|string',
            'blood_group' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'nullable|email',
            'room_number' => 'nullable|string',
            'bed_number' => 'nullable|string',
            'primary_substance' => 'required|string',
            'nok_name' => 'required|string',
            'nok_phone' => 'required|string',
        ]);

        $patient = Patient::create([
            'id' => 'PAT-' . strtoupper(uniqid()),
            'name' => $validated['name'],
            'dob' => $validated['dob'],
            'gender' => $validated['gender'],
            'blood_group' => $validated['blood_group'] ?? 'O+',
            'phone' => $validated['phone'],
            'email' => $validated['email'],
            'room_number' => $validated['room_number'] ?? 'Room 101',
            'bed_number' => $validated['bed_number'] ?? 'Bed A',
            'stage' => 'Inpatient Recovery',
            'sobriety_days' => 1,
            'admission_date' => now()->toDateString()
        ]);

        NextOfKin::create([
            'patient_id' => $patient->id,
            'name' => $validated['nok_name'],
            'relationship' => $request->nok_rel ?? 'Relative',
            'phone' => $validated['nok_phone'],
            'address' => $request->nok_address ?? 'On File'
        ]);

        PsychiatricHistory::create([
            'patient_id' => $patient->id,
            'primary_substance' => $validated['primary_substance'],
            'secondary_substance' => $request->secondary_substance ?? 'None',
            'addiction_duration_years' => $request->addiction_duration_years ?? 1,
            'suicide_risk' => $request->suicide_risk ?? 'Low',
            'clinical_notes' => $request->notes ?? 'Clinical intake record.'
        ]);

        return response()->json(['success' => true, 'patient' => $patient->load(['nextOfKin', 'psychiatricHistory'])], 201);
    }

    /**
     * Batch import multiple residents from CSV payload.
     */
    public function batchImport(Request $request): JsonResponse
    {
        $batch = $request->input('residents', []);
        $created = [];

        foreach ($batch as $data) {
            $patient = Patient::create([
                'id' => 'PAT-' . strtoupper(uniqid()),
                'name' => $data['full_name'],
                'dob' => $data['dob'],
                'gender' => $data['gender'] ?? 'Male',
                'blood_group' => $data['blood_group'] ?? 'O+',
                'phone' => $data['phone'] ?? null,
                'room_number' => $data['room_number'] ?? 'Room 101',
                'bed_number' => $data['bed_number'] ?? 'Bed A',
                'stage' => 'Inpatient Recovery',
                'sobriety_days' => $data['sobriety_days'] ?? 1,
                'admission_date' => now()->toDateString()
            ]);

            NextOfKin::create([
                'patient_id' => $patient->id,
                'name' => $data['nok_name'] ?? 'Not provided',
                'relationship' => $data['nok_rel'] ?? 'Relative',
                'phone' => $data['nok_phone'] ?? ''
            ]);

            PsychiatricHistory::create([
                'patient_id' => $patient->id,
                'primary_substance' => $data['primary_substance'] ?? 'Alcohol',
                'suicide_risk' => $data['suicide_risk'] ?? 'Low',
                'clinical_notes' => 'Batch CSV admission.'
            ]);

            $created[] = $patient;
        }

        return response()->json(['success' => true, 'count' => count($created)], 200);
    }

    /**
     * Mark resident qualified for graduation release.
     */
    public function qualifyGraduation(Request $request, string $id): JsonResponse
    {
        $patient = Patient::findOrFail($id);
        $qualified = $request->boolean('qualified');

        $patient->update([
            'graduation_qualified' => $qualified,
            'graduation_date' => $qualified ? now()->toDateString() : null,
            'stage' => $qualified ? 'Graduated' : $patient->stage
        ]);

        return response()->json(['success' => true, 'patient' => $patient]);
    }
}
