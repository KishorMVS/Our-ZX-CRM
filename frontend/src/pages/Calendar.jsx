import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Clock, Users, Trash2, Repeat } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const RECURRENCE_OPTIONS = [
    { value: "NONE", label: "One-time" },
    { value: "DAILY", label: "Every day" },
    { value: "DAILY_EXCEPT_WEEKENDS", label: "Every day except Sat & Sun" },
    { value: "DAILY_EXCEPT_SUNDAY", label: "Every day except Sunday" },
];

const REMINDER_OPTIONS = [
    { value: 5, label: "5 minutes before" },
    { value: 10, label: "10 minutes before" },
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 120, label: "2 hours before" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Does a meeting occur on the given calendar date?
const occursOn = (meeting, date) => {
    const start = new Date(meeting.startAt);
    if (meeting.recurrence === "NONE") return sameDay(start, date);
    if (date < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false; // before it began
    const day = date.getDay();
    if (meeting.recurrence === "DAILY_EXCEPT_WEEKENDS" && (day === 0 || day === 6)) return false;
    if (meeting.recurrence === "DAILY_EXCEPT_SUNDAY" && day === 0) return false;
    return true;
};

const timeStr = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const Calendar = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

    const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
    const [showCreate, setShowCreate] = useState(false);
    const [createDate, setCreateDate] = useState(null);
    const [selectedMeeting, setSelectedMeeting] = useState(null);

    // Visible month range (pad to whole weeks).
    const { gridStart, gridDays, monthFrom, monthTo } = useMemo(() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = new Date(first);
        start.setDate(first.getDate() - first.getDay()); // back to Sunday
        const days = Array.from({ length: 42 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
        return {
            gridStart: start,
            gridDays: days,
            monthFrom: days[0].toISOString(),
            monthTo: days[days.length - 1].toISOString(),
        };
    }, [cursor]);

    const { data: meetings = [], isLoading } = useQuery({
        queryKey: ["meetings", monthFrom, monthTo],
        queryFn: async () => (await api.get(`/meetings?from=${monthFrom}&to=${monthTo}`)).data,
    });

    const { data: users = [] } = useQuery({
        queryKey: ["chatUsers"],
        queryFn: async () => (await api.get("/chat/users")).data,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => api.delete(`/meetings/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["meetings"] });
            setSelectedMeeting(null);
            toast.success("Meeting deleted");
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to delete meeting"),
    });

    const reminderMutation = useMutation({
        mutationFn: async ({ id, reminderMinutes }) => api.patch(`/meetings/${id}/reminder`, { reminderMinutes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["meetings"] });
            toast.success("Reminder updated");
        },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to update reminder"),
    });

    const openCreate = (date) => {
        setCreateDate(date || new Date());
        setShowCreate(true);
    };

    const today = new Date();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
                <p className="text-sm text-gray-500">Click any day to schedule a meeting · reminders included</p>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Month nav */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
                    </h2>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            Today
                        </button>
                        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>
                ) : (
                    <div className="grid grid-cols-7">
                        {WEEKDAYS.map((d) => (
                            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">{d}</div>
                        ))}
                        {gridDays.map((date, i) => {
                            const inMonth = date.getMonth() === cursor.getMonth();
                            const dayMeetings = meetings.filter((m) => occursOn(m, date));
                            const isToday = sameDay(date, today);
                            return (
                                <div
                                    key={i}
                                    onClick={() => openCreate(date)}
                                    className={`min-h-[96px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors hover:bg-indigo-50/30 ${inMonth ? "bg-white" : "bg-gray-50/50"}`}
                                >
                                    <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center h-6 w-6 rounded-full ${isToday ? "bg-indigo-600 text-white" : inMonth ? "text-gray-700" : "text-gray-400"}`}>
                                        {date.getDate()}
                                    </div>
                                    <div className="space-y-1">
                                        {dayMeetings.slice(0, 3).map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedMeeting(m); }}
                                                className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium bg-indigo-100 text-indigo-700 truncate hover:bg-indigo-200 flex items-center gap-1"
                                            >
                                                {m.recurrence !== "NONE" && <Repeat className="h-2.5 w-2.5 flex-shrink-0" />}
                                                <span className="truncate">{timeStr(m.startAt)} {m.title}</span>
                                            </button>
                                        ))}
                                        {dayMeetings.length > 3 && (
                                            <div className="text-[10px] text-gray-400 px-1.5">+{dayMeetings.length - 3} more</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateMeetingModal
                    initialDate={createDate}
                    users={users}
                    currentUserId={user?.id}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ["meetings"] }); }}
                />
            )}

            {selectedMeeting && (
                <MeetingDetailModal
                    meeting={selectedMeeting}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedMeeting(null)}
                    onDelete={() => deleteMutation.mutate(selectedMeeting.id)}
                    onSetReminder={(minutes) => reminderMutation.mutate({ id: selectedMeeting.id, reminderMinutes: minutes })}
                    deleting={deleteMutation.isPending}
                    savingReminder={reminderMutation.isPending}
                />
            )}
        </div>
    );
};

// ── Create modal ──────────────────────────────────────────────────────────────
const toLocalInput = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

const CreateMeetingModal = ({ initialDate, users, currentUserId, onClose, onCreated }) => {
    const start = new Date(initialDate);
    if (start <= new Date()) start.setHours(start.getHours() + 1, 0, 0, 0);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startAt, setStartAt] = useState(toLocalInput(start));
    const [recurrence, setRecurrence] = useState("NONE");
    const [attendeeIds, setAttendeeIds] = useState([]);
    const [search, setSearch] = useState("");

    const mutation = useMutation({
        mutationFn: async (payload) => api.post("/meetings", payload),
        onSuccess: () => { toast.success("Meeting scheduled — invites sent"); onCreated(); },
        onError: (e) => toast.error(e.response?.data?.message || "Failed to schedule meeting"),
    });

    const selectable = (users || []).filter((u) =>
        u.id !== currentUserId &&
        (u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
    );

    const toggle = (id) => setAttendeeIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    const submit = () => {
        if (!title.trim()) return toast.error("Enter a title");
        if (attendeeIds.length === 0) return toast.error("Select at least one attendee");
        mutation.mutate({
            title: title.trim(),
            description: description.trim() || undefined,
            startAt: new Date(startAt).toISOString(),
            recurrence,
            attendeeIds,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Schedule Meeting</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="h-5 w-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sprint planning"
                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start</label>
                            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Repeat</label>
                            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                                {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Attendees</label>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..."
                            className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 mb-2" />
                        <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-50">
                            {selectable.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No users found</p>}
                            {selectable.map((u) => (
                                <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" checked={attendeeIds.includes(u.id)} onChange={() => toggle(u.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="font-medium text-gray-800">{u.name}</span>
                                    <span className="text-xs text-gray-400">{u.role}</span>
                                </label>
                            ))}
                        </div>
                        {attendeeIds.length > 0 && <p className="text-xs text-gray-500 mt-1">{attendeeIds.length} selected</p>}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={mutation.isPending}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                        {mutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Schedule
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Detail modal ────────────────────────────────────────────────────────────
const MeetingDetailModal = ({ meeting, isAdmin, onClose, onDelete, onSetReminder, deleting, savingReminder }) => {
    const recLabel = RECURRENCE_OPTIONS.find((o) => o.value === meeting.recurrence)?.label || "One-time";
    const canDelete = meeting.isCreator || isAdmin;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{meeting.title}</h2>
                        <p className="text-xs text-gray-500 mt-1">Scheduled by {meeting.creatorName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-5 space-y-4">
                    {meeting.description && <p className="text-sm text-gray-700">{meeting.description}</p>}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {new Date(meeting.startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Repeat className="h-4 w-4 text-gray-400" /> {recLabel}
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span>{meeting.attendees.map((a) => a.name).join(", ")}</span>
                    </div>

                    {meeting.myReminderMinutes !== null && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">My reminder {savingReminder && <Loader2 className="inline h-3 w-3 animate-spin" />}</label>
                            <select
                                defaultValue={meeting.myReminderMinutes}
                                onChange={(e) => onSetReminder(Number(e.target.value))}
                                disabled={savingReminder}
                                className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                            >
                                {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {canDelete && (
                    <div className="p-4 border-t border-gray-100 flex justify-end">
                        <button onClick={onDelete} disabled={deleting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50">
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete meeting
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Calendar;
