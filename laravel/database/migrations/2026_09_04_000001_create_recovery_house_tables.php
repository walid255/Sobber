<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for SerenityCare Recovery House.
     */
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->date('dob');
            $table->string('gender', 20);
            $table->string('blood_group', 10)->default('O+');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('photo_url')->nullable();
            $table->string('room_number')->default('Room 101');
            $table->string('bed_number')->default('Bed A');
            $table->enum('stage', ['Detoxification', 'Inpatient Recovery', 'Transition / Halfway', 'Intensive Outpatient', 'Graduated'])->default('Inpatient Recovery');
            $table->integer('sobriety_days')->default(1);
            $table->boolean('graduation_qualified')->default(false);
            $table->date('graduation_date')->nullable();
            $table->date('admission_date');
            $table->timestamps();
        });

        Schema::create('next_of_kin', function (Blueprint $table) {
            $table->id();
            $table->string('patient_id');
            $table->string('name');
            $table->string('relationship');
            $table->string('phone');
            $table->text('address')->nullable();
            $table->boolean('emergency_consent')->default(true);
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('psychiatric_histories', function (Blueprint $table) {
            $table->id();
            $table->string('patient_id')->unique();
            $table->string('primary_substance');
            $table->string('secondary_substance')->default('None');
            $table->integer('addiction_duration_years')->default(1);
            $table->integer('prior_rehabs')->default(0);
            $table->string('suicide_risk')->default('Low');
            $table->json('diagnoses')->nullable();
            $table->json('allergies')->nullable();
            $table->text('clinical_notes')->nullable();
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('prescriptions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('patient_id');
            $table->string('medication_name');
            $table->string('dosage');
            $table->string('frequency');
            $table->json('times');
            $table->text('instructions')->nullable();
            $table->string('prescribing_doctor');
            $table->enum('status', ['Active', 'Discontinued'])->default('Active');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('medication_logs', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('patient_id');
            $table->string('prescription_id');
            $table->string('med_name');
            $table->string('scheduled_time');
            $table->enum('status', ['Pending', 'Administered', 'Refused', 'Missed'])->default('Pending');
            $table->dateTime('administered_at')->nullable();
            $table->string('nurse_name')->nullable();
            $table->text('notes')->nullable();
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('category');
            $table->integer('quantity')->default(0);
            $table->string('unit')->default('Units');
            $table->integer('min_threshold')->default(10);
            $table->decimal('cost', 8, 2)->default(0.00);
            $table->string('batch_number')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('location')->nullable();
            $table->boolean('controlled')->default(false);
            $table->timestamps();
        });

        Schema::create('timetable_events', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->enum('day', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
            $table->string('time_slot');
            $table->string('title');
            $table->string('category');
            $table->string('facilitator');
            $table->string('location');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_events');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('medication_logs');
        Schema::dropIfExists('prescriptions');
        Schema::dropIfExists('psychiatric_histories');
        Schema::dropIfExists('next_of_kin');
        Schema::dropIfExists('patients');
    }
};
