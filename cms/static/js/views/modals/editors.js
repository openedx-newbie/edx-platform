define([
    'jquery',
    'underscore',
    'date',
    'js/views/baseview',
    'js/utils/date_utils'
], function ($, _, date, BaseView, DateUtils) {
    'use strict';
    var AbstractEditor, BaseDateEditor, ReleaseDateEditor, DueDateEditor, GradingEditor,
        PublishEditor, StaffLockEditor, VerificationAccessEditor, TimedExaminationPreferenceEditor;

    AbstractEditor = BaseView.extend({
        tagName: 'section',
        templateName: null,
        initialize: function() {
            this.template = this.loadTemplate(this.templateName);
            this.parentElement = this.options.parentElement;
            this.render();
        },

        render: function () {
            var html = this.template($.extend({}, {
                xblockInfo: this.model,
                xblockType: this.options.xblockType
            }, this.getContext()));

            this.$el.html(html);
            this.parentElement.append(this.$el);
        },

        getContext: function () {
            return {};
        },

        getRequestData: function () {
            return {};
        }
    });

    BaseDateEditor = AbstractEditor.extend({
        // Attribute name in the model, should be defined in children classes.
        fieldName: null,

        events : {
            'click .clear-date': 'clearValue'
        },

        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.$('input.date').datepicker({'dateFormat': 'm/d/yy'});
            this.$('input.time').timepicker({
                'timeFormat' : 'H:i',
                'forceRoundTime': true
            });
            if (this.model.get(this.fieldName)) {
                DateUtils.setDate(
                    this.$('input.date'), this.$('input.time'),
                    this.model.get(this.fieldName)
                );
            }
        }
    });

    DueDateEditor = BaseDateEditor.extend({
        fieldName: 'due',
        templateName: 'due-date-editor',
        className: 'modal-section-content has-actions due-date-input grading-due-date',

        getValue: function () {
            return DateUtils.getDate(this.$('#due_date'), this.$('#due_time'));
        },

        clearValue: function (event) {
            event.preventDefault();
            this.$('#due_time, #due_date').val('');
        },

        getRequestData: function () {
            return {
                metadata: {
                    'due': this.getValue()
                }
            };
        }
    });

    ReleaseDateEditor = BaseDateEditor.extend({
        fieldName: 'start',
        templateName: 'release-date-editor',
        className: 'edit-settings-release scheduled-date-input',
        startingReleaseDate: null,

        afterRender: function () {
            BaseDateEditor.prototype.afterRender.call(this);
            // Store the starting date and time so that we can determine if the user
            // actually changed it when "Save" is pressed.
            this.startingReleaseDate = this.getValue();
        },

        getValue: function () {
            return DateUtils.getDate(this.$('#start_date'), this.$('#start_time'));
        },

        clearValue: function (event) {
            event.preventDefault();
            this.$('#start_time, #start_date').val('');
        },

        getRequestData: function () {
            var newReleaseDate = this.getValue();
            if (JSON.stringify(newReleaseDate) === JSON.stringify(this.startingReleaseDate)) {
                return {};
            }
            return {
                metadata: {
                    'start': newReleaseDate
                }
            };
        }
    });

    TimedExaminationPreferenceEditor = AbstractEditor.extend({
        templateName: 'timed-examination-preference-editor',
        className: 'edit-settings-timed-examination',

        events : {
            'change #id_timed_examination': 'timedExamination',
            'focusout #id_time_limit': 'timeLimitFocusout'
        },
        timeLimitFocusout: function(event) {
            var selectedTimeLimit = $(event.currentTarget).val();
            if (!this.isValidTimeLimit(selectedTimeLimit)) {
                $(event.currentTarget).val("00:30");
            }
        },
        timedExamination: function (event) {
            event.preventDefault();
            if (!$(event.currentTarget).is(':checked')) {
                this.$('#id_exam_proctoring').attr('checked', false);
                this.$('#id_time_limit').val('00:00');
                this.$('#id_exam_proctoring').attr('disabled','disabled');
                this.$('#id_time_limit').attr('disabled', 'disabled');
                this.$('#id_practice_exam').attr('checked', false);
                this.$('#id_practice_exam').attr('disabled','disabled');
            }
            else {
                if (!this.isValidTimeLimit(this.$('#id_time_limit').val())) {
                    this.$('#id_time_limit').val('00:30');
                }
                this.$('#id_practice_exam').removeAttr('disabled');
                this.$('#id_exam_proctoring').removeAttr('disabled');
                this.$('#id_time_limit').removeAttr('disabled');
            }
            return true;
        },
        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.$('input.time').timepicker({
                'timeFormat' : 'H:i',
                'minTime': '00:30',
                'maxTime': '05:00',
                'forceRoundTime': false
            });
            this.setExamTime(this.model.get('default_time_limit_minutes'));
            this.setExamTmePreference(this.model.get('is_time_limited'));
            this.setExamProctoring(this.model.get('is_proctored_enabled'));
            this.setPracticeExam(this.model.get('is_practice_exam'));
        },
        setPracticeExam: function(value) {
            this.$('#id_practice_exam').prop('checked', value);
        },
        setExamProctoring: function(value) {
            this.$('#id_exam_proctoring').prop('checked', value);
        },
        setExamTime: function(value) {
            var time = this.convertTimeLimitMinutesToString(value);
            this.$('#id_time_limit').val(time);
        },
        setExamTmePreference: function (value) {
            this.$('#id_timed_examination').prop('checked', value);
            if (!this.$('#id_timed_examination').is(':checked')) {
                this.$('#id_exam_proctoring').attr('disabled','disabled');
                this.$('#id_time_limit').attr('disabled', 'disabled');
                this.$('#id_practice_exam').attr('disabled', 'disabled');
            }
        },
        isExamTimeEnabled: function () {
            return this.$('#id_timed_examination').is(':checked');
        },
        isPracticeExam: function () {
            return this.$('#id_practice_exam').is(':checked');
        },
        isValidTimeLimit: function(time_limit) {
            var pattern = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
            return pattern.test(time_limit) && time_limit !== "00:00";
        },
        getExamTimeLimit: function () {
            return this.$('#id_time_limit').val();
        },
        convertTimeLimitMinutesToString: function (timeLimitMinutes) {
            var hoursStr = "" + Math.floor(timeLimitMinutes / 60);
            var actualMinutesStr = "" + (timeLimitMinutes % 60);
            hoursStr = "00".substring(0, 2 - hoursStr.length) + hoursStr;
            actualMinutesStr = "00".substring(0, 2 - actualMinutesStr.length) + actualMinutesStr;
            return hoursStr + ":" + actualMinutesStr;
        },
        convertTimeLimitToMinutes: function (time_limit) {
            var time = time_limit.split(':');
            var total_time = (parseInt(time[0]) * 60) + parseInt(time[1]);
            return total_time;
        },
        isExamProctoringEnabled: function () {
            return this.$('#id_exam_proctoring').is(':checked');
        },
        getRequestData: function () {
            var time_limit = this.getExamTimeLimit();
            return {
                metadata: {
                    'is_practice_exam': this.isPracticeExam(),
                    'is_time_limited': this.isExamTimeEnabled(),
                    'is_proctored_enabled': this.isExamProctoringEnabled(),
                    'default_time_limit_minutes': this.convertTimeLimitToMinutes(time_limit)
                }
            };
        }
    });

    GradingEditor = AbstractEditor.extend({
        templateName: 'grading-editor',
        className: 'edit-settings-grading',

        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.setValue(this.model.get('format'));
        },

        setValue: function (value) {
            this.$('#grading_type').val(value);
        },

        getValue: function () {
            return this.$('#grading_type').val();
        },

        getRequestData: function () {
            return {
                'graderType': this.getValue()
            };
        },

        getContext: function () {
            return {
                graderTypes: JSON.parse(this.model.get('course_graders'))
            };
        }
    });

    PublishEditor = AbstractEditor.extend({
        templateName: 'publish-editor',
        className: 'edit-settings-publish',
        getRequestData: function () {
            return {
                publish: 'make_public'
            };
        }
    });

    StaffLockEditor = AbstractEditor.extend({
        templateName: 'staff-lock-editor',
        className: 'edit-staff-lock',
        isModelLocked: function() {
            return this.model.get('has_explicit_staff_lock');
        },

        isAncestorLocked: function() {
            return this.model.get('ancestor_has_staff_lock');
        },

        afterRender: function () {
            AbstractEditor.prototype.afterRender.call(this);
            this.setLock(this.isModelLocked());
        },

        setLock: function(value) {
            this.$('#staff_lock').prop('checked', value);
        },

        isLocked: function() {
            return this.$('#staff_lock').is(':checked');
        },

        hasChanges: function() {
            return this.isModelLocked() !== this.isLocked();
        },

        getRequestData: function() {
            return this.hasChanges() ? {
                publish: 'republish',
                metadata: {
                    visible_to_staff_only: this.isLocked() ? true : null
                    }
                } : {};
        },

        getContext: function () {
            return {
                hasExplicitStaffLock: this.isModelLocked(),
                ancestorLocked: this.isAncestorLocked()
            };
        }
    });

    VerificationAccessEditor = AbstractEditor.extend({
        templateName: 'verification-access-editor',
        className: 'edit-verification-access',

        // This constant MUST match the group ID
        // defined by VerificationPartitionScheme on the backend!
        ALLOW_GROUP_ID: 1,

        getSelectedPartition: function() {
            var hasRestrictions = $("#verification-access-checkbox").is(":checked"),
                selectedPartitionID = null;

            if (hasRestrictions) {
                selectedPartitionID = $("#verification-partition-select").val();
            }

            return parseInt(selectedPartitionID, 10);
        },

        getGroupAccess: function() {
            var groupAccess = _.clone(this.model.get('group_access')) || [],
                userPartitions = this.model.get('user_partitions') || [],
                selectedPartition = this.getSelectedPartition(),
                that = this;

            // We display a simplified UI to course authors.
            // On the backend, each verification checkpoint is associated
            // with a user partition that has two groups.  For example,
            // if two checkpoints were defined, they might look like:
            //
            // Midterm A: |-- ALLOW --|-- DENY --|
            // Midterm B: |-- ALLOW --|-- DENY --|
            //
            // To make life easier for course authors, we display
            // *one* option for each checkpoint:
            //
            // [X] Must complete verification checkpoint
            //     Dropdown:
            //        * Midterm A
            //        * Midterm B
            //
            // This is where we map the simplified UI to
            // the underlying user partition.  If the user checked
            // the box, that means there *is* a restriction,
            // so only the "ALLOW" group for the selected partition has access.
            // Otherwise, all groups in the partition have access.
            //
            _.each(userPartitions, function(partition) {
                if (partition.scheme === "verification") {
                    if (selectedPartition === partition.id) {
                        groupAccess[partition.id] = [that.ALLOW_GROUP_ID];
                    } else {
                        delete groupAccess[partition.id];
                    }
                }
            });

            return groupAccess;
        },

        getRequestData: function() {
            var groupAccess = this.getGroupAccess(),
                hasChanges = !_.isEqual(groupAccess, this.model.get('group_access'));

            return hasChanges ? {
                publish: 'republish',
                metadata: {
                    group_access: groupAccess,
                }
            } : {};
        },

        getContext: function() {
            var partitions = this.model.get("user_partitions"),
                hasRestrictions = false,
                verificationPartitions = [],
                isSelected = false;

            // Display a simplified version of verified partition schemes.
            // Although there are two groups defined (ALLOW and DENY),
            // we show only the ALLOW group.
            // To avoid searching all the groups, we're assuming that the editor
            // either sets the ALLOW group or doesn't set any groups (implicitly allow all).
            _.each(partitions, function(item) {
                if (item.scheme === "verification") {
                    isSelected = _.any(_.pluck(item.groups, "selected"));
                    hasRestrictions = hasRestrictions || isSelected;

                    verificationPartitions.push({
                        "id": item.id,
                        "name": item.name,
                        "selected": isSelected,
                    });
                }
            });

            return {
                "hasVerificationRestrictions": hasRestrictions,
                "verificationPartitions": verificationPartitions,
            };
        }
    });

    return {
        AbstractEditor: AbstractEditor,
        BaseDateEditor: BaseDateEditor,
        ReleaseDateEditor: ReleaseDateEditor,
        DueDateEditor: DueDateEditor,
        GradingEditor: GradingEditor,
        PublishEditor: PublishEditor,
        StaffLockEditor: StaffLockEditor,
        VerificationAccessEditor: VerificationAccessEditor,
        TimedExaminationPreferenceEditor: TimedExaminationPreferenceEditor
    };
});
