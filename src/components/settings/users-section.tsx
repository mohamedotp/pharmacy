"use client";

import { useState, useEffect } from "react";
import {
  Users, ShieldCheck, Key, AlertTriangle, Edit, RefreshCw, Filter, CheckCircle2, XCircle, Plus, Trash2, Info, Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUsers, createUser, updateUser, deleteUser, freezeUsersByRole } from "@/app/actions/users";
import { useAuthStore } from "@/store/auth-store";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserData = {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  role: { id: string; name: string };
  pharmacy_id: string;
};

export function UsersSection() {
  const { user, pharmacy } = useAuthStore();
  const pharmacyId = pharmacy?.id || user?.pharmacy?.id;

  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    password: "",
    roleName: "cashier"
  });
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dynamic cashier role freeze status checking
  const cashiers = usersList.filter(u => u.role?.name?.toLowerCase() === "cashier");
  const isCashierRoleFrozen = cashiers.length > 0 && cashiers.every(u => !u.is_active);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await getUsers(pharmacyId as string);
    if (!error && data) {
      setUsersList(data as unknown as UserData[]);
    }
    setLoading(false);
  };

  const handleToggleFreezeCashiers = async () => {
    const nextActive = isCashierRoleFrozen;
    const actionText = nextActive ? "تنشيط وإلغاء تجميد" : "تجميد وتعطيل";
    const confirm = window.confirm(`هل أنت متأكد من رغبتك في ${actionText} جميع حسابات الصرافين (الكاشير)؟`);
    if (!confirm) return;

    setActionLoading(true);
    setError(null);
    const { error: freezeError } = await freezeUsersByRole(pharmacyId as string, "cashier", nextActive);
    if (freezeError) {
      setError(freezeError);
    } else {
      loadUsers();
    }
    setActionLoading(false);
  };
  
  // Avatar upload states
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (pharmacyId) {
      loadUsers();
    }
  }, [pharmacyId]);

  const handleAddUser = async () => {
    setActionLoading(true);
    setError(null);
    const { error } = await createUser({
      ...formData,
      pharmacyId: pharmacyId as string
    });
    
    if (error) {
      setError(error);
    } else {
      setIsAddOpen(false);
      setFormData({ fullName: "", username: "", password: "", roleName: "cashier" });
      loadUsers();
    }
    setActionLoading(false);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError(null);
    const { error } = await updateUser(selectedUser.id, {
      fullName: formData.fullName,
      roleName: formData.roleName,
      isActive: selectedUser.is_active,
      avatarUrl: newAvatarUrl
    });
    
    if (error) {
      setError(error);
    } else {
      setIsEditOpen(false);
      setSelectedUser(null);
      loadUsers();
      // If updating current logged in user, refresh their header/profile
      if (selectedUser.id === user?.id) {
        useAuthStore.getState().fetchProfile();
      }
    }
    setActionLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError(null);
    const { error } = await deleteUser(selectedUser.id);
    
    if (error) {
      setError(error);
    } else {
      setIsDeleteOpen(false);
      setSelectedUser(null);
      loadUsers();
    }
    setActionLoading(false);
  };

  const openEdit = (u: UserData) => {
    setSelectedUser(u);
    setFormData({
      fullName: u.full_name,
      username: u.email.split("@")[0],
      password: "",
      roleName: u.role?.name || "cashier"
    });
    setNewAvatarUrl(u.avatar_url || null);
    setIsEditOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    setUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload image file
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setNewAvatarUrl(data.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError("فشل رفع الصورة: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleImageDelete = () => {
    setNewAvatarUrl(null);
  };

  const openDelete = (u: UserData) => {
    setSelectedUser(u);
    setIsDeleteOpen(true);
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "admin": return "bg-orange-50 text-orange-700";
      case "pharmacist": return "bg-blue-50 text-blue-700";
      case "cashier": return "bg-slate-100 text-slate-700";
      case "delivery": return "bg-emerald-50 text-emerald-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getRoleLabel = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "admin": return "مدير";
      case "pharmacist": return "صيدلي";
      case "cashier": return "كاشير";
      case "delivery": return "دليفري";
      default: return roleName;
    }
  };

  const activeCount = usersList.filter(u => u.is_active).length;
  const rolesCount = new Set(usersList.map(u => u.role?.name)).size;

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
              <Users size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500 mb-1">إجمالي المستخدمين</p>
            <h3 className="text-2xl font-black text-slate-800">{usersList.length}</h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
              <ShieldCheck size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500 mb-1">المستخدمين النشطين</p>
            <h3 className="text-2xl font-black text-slate-800">{activeCount}</h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-3">
              <Key size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500 mb-1">أدوار محددة</p>
            <h3 className="text-2xl font-black text-slate-800">{rolesCount}</h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-3">
              <AlertTriangle size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500 mb-1">تنبيهات أمنية</p>
            <h3 className="text-2xl font-black text-slate-800">0</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Users Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="font-black text-slate-800">قائمة المستخدمين النشطين</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-8 text-xs font-bold gap-2 rounded-lg text-slate-600 border-slate-200" onClick={loadUsers}>
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> تحديث
                  </Button>
                  <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger render={
                      <Button className="h-8 text-xs font-bold gap-2 rounded-lg bg-[#002B5B] hover:bg-[#001f42] text-white" />
                    }>
                      <Plus size={14} /> إضافة مستخدم
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-right">إضافة مستخدم جديد</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
                        <div className="grid gap-2">
                          <label className="text-xs font-bold text-slate-500">الاسم الكامل</label>
                          <Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="h-9" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-bold text-slate-500">اسم المستخدم (للدخول)</label>
                          <Input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="h-9 text-left" dir="ltr" placeholder="أدخل اسم المستخدم (بدون مسافات)" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-bold text-slate-500">كلمة المرور</label>
                          <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="h-9" placeholder="افتراضي: 12345678" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-bold text-slate-500">الدور</label>
                          <Select value={formData.roleName} onValueChange={(val) => setFormData({...formData, roleName: val || "cashier"})}>
                            <SelectTrigger className="h-9 text-right" dir="rtl">
                              <SelectValue placeholder="اختر الدور" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="admin">مدير</SelectItem>
                              <SelectItem value="pharmacist">صيدلي</SelectItem>
                              <SelectItem value="cashier">صراف (كاشير)</SelectItem>
                              <SelectItem value="delivery">دليفري</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="sm:justify-start">
                        <Button onClick={handleAddUser} disabled={actionLoading} className="bg-[#002B5B] hover:bg-[#001f42] text-white">
                          {actionLoading ? "جاري الإضافة..." : "حفظ"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50/50 text-slate-500 font-bold text-xs">
                    <tr>
                      <th className="px-4 py-3">المستخدم</th>
                      <th className="px-4 py-3">الدور</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3 text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">جاري التحميل...</td></tr>
                    ) : usersList.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-500">لا يوجد مستخدمين</td></tr>
                    ) : usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-100 shadow-sm shrink-0">
                              {u.avatar_url ? (
                                <AvatarImage src={u.avatar_url} alt={u.full_name} className="object-cover" />
                              ) : (
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {u.full_name?.substring(0,2).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{u.full_name}</p>
                              <p className="text-[10px] text-slate-500">{u.email.split("@")[0]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getRoleBadgeColor(u.role?.name || '')}`}>
                            {getRoleLabel(u.role?.name || 'غير محدد')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.is_active ? 
                            <span className="text-emerald-600 font-bold">نشط</span> : 
                            <span className="text-slate-400">غير نشط</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(u)} className="text-slate-400 hover:text-[#002B5B] transition-colors"><Edit size={16} /></button>
                            <button onClick={() => openDelete(u)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissions Matrix & Quick Control */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800">مصفوفة الصلاحيات</h3>
                <button className="text-xs font-bold text-[#002B5B] hover:underline">تعديل الكل</button>
              </div>

              <div className="space-y-4 opacity-70 pointer-events-none">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <h4 className="font-bold text-sm text-slate-800 mb-2">إدارة المخزون</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">إضافة أصناف جديدة</span>
                      <CheckCircle2 size={16} className="text-[#002B5B]" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4 text-center">إدارة الصلاحيات المفصلة قريباً</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl bg-slate-50 border border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Info size={16} className="text-[#002B5B]" />
                <h4 className="font-black text-sm text-[#002B5B]">تحكم سريع بالأدوار</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                {isCashierRoleFrozen 
                  ? "جميع حسابات الصيادلة والصرافين مجمدة حالياً. يمكنك إلغاء التجميد لإعادة تمكين دخولهم للبرنامج."
                  : "يمكنك تعطيل دخول جميع المستخدمين في دور \"الصراف\" مؤقتاً أثناء عمليات الجرد السنوي."
                }
              </p>
              <Button
                onClick={handleToggleFreezeCashiers}
                disabled={actionLoading || cashiers.length === 0}
                className={`w-full font-bold text-xs h-9 rounded-xl transition-colors ${
                  isCashierRoleFrozen
                    ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                    : "bg-rose-100 hover:bg-rose-200 text-rose-700"
                }`}
              >
                {actionLoading 
                  ? "جاري المعالجة..." 
                  : isCashierRoleFrozen 
                    ? "إلغاء تجميد دور \"الصراف\"" 
                    : "تجميد دور \"الصراف\""
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل بيانات المستخدم</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            
            {/* User Avatar Section */}
            <div className="flex flex-col items-center justify-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-2">
              <Avatar className="h-20 w-20 border-2 border-white shadow-md relative">
                {newAvatarUrl ? (
                  <AvatarImage src={newAvatarUrl} className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                    {selectedUser?.full_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  className="h-8 text-xs font-bold relative gap-1.5"
                >
                  <Camera size={14} />
                  {uploading ? "جاري الرفع..." : "رفع صورة"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                </Button>
                {newAvatarUrl && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleImageDelete}
                    className="h-8 text-xs font-bold gap-1.5"
                  >
                    <Trash2 size={14} />
                    حذف الصورة
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold text-slate-500">الاسم الكامل</label>
              <Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="h-9" />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold text-slate-500">الدور</label>
              <Select value={formData.roleName} onValueChange={(val) => setFormData({...formData, roleName: val || "cashier"})}>
                <SelectTrigger className="h-9 text-right" dir="rtl">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="pharmacist">صيدلي</SelectItem>
                  <SelectItem value="cashier">كاشير</SelectItem>
                  <SelectItem value="delivery">دليفري</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User Active/Inactive Switch Status */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl mt-1">
              <div>
                <p className="text-xs font-bold text-slate-800">حالة الحساب</p>
                <p className="text-[10px] text-slate-400 mt-0.5">تنشيط أو تعطيل دخول هذا المستخدم للنظام</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={selectedUser?.is_active}
                onClick={() => setSelectedUser(prev => prev ? { ...prev, is_active: !prev.is_active } : null)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  selectedUser?.is_active ? "bg-[#002B5B]" : "bg-slate-200"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    selectedUser?.is_active ? "-translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={handleUpdateUser} disabled={actionLoading} className="bg-[#002B5B] hover:bg-[#001f42] text-white">
              {actionLoading ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-red-600">حذف المستخدم</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-4">{error}</div>}
            <p className="text-sm text-slate-600">
              هل أنت متأكد من رغبتك في حذف المستخدم <strong>{selectedUser?.full_name}</strong>؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف حسابه من النظام بشكل نهائي.
            </p>
          </div>
          <DialogFooter className="sm:justify-start gap-2">
            <Button variant="destructive" onClick={handleDeleteUser} disabled={actionLoading}>
              {actionLoading ? "جاري الحذف..." : "تأكيد الحذف"}
            </Button>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={actionLoading}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
