import { useCrm } from '@/store/CrmContext';
import Layout from '@/components/crm/Layout';
import StatsCard from '@/components/crm/StatsCard';
import { Users, CalendarCheck, Target, TrendingUp, Clock, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getContactProgress } from '@/types/crm';

export default function Dashboard() {
  const { contacts, campaigns } = useCrm();
  const today = new Date().toISOString().split('T')[0];

  const totalContacts = contacts.length;
  const inSequence = contacts.filter(c => c.status === 'In Sequence').length;
  const warm = contacts.filter(c => c.status === 'Warm').length;
  const hot = contacts.filter(c => c.status === 'Hot').length;
  const disqualified = contacts.filter(c => c.status === 'Disqualified').length;
  const unworked = contacts.filter(c => c.status === 'Unworked').length;

  const touchesToday = contacts.reduce((acc, c) =>
    acc + c.touchLogs.filter(t => t.date === today).length, 0
  );
  const meetingsBooked = contacts.filter(c =>
    c.weekProgress.some(w => w.outcome === 'Meeting Booked')
  ).length;
  const positiveReplies = contacts.filter(c =>
    c.weekProgress.some(w => w.outcome === 'Positive Reply')
  ).length;

  const overdue = contacts.filter(c =>
    c.status === 'In Sequence' && c.nextTouchDate < today
  ).length;

  const conversionRate = totalContacts > 0 ? Math.round((meetingsBooked / totalContacts) * 100) : 0;

  // Week distribution
  const weekData = Array.from({ length: 12 }, (_, i) => ({
    week: `W${i + 1}`,
    count: contacts.filter(c => c.currentWeek === i + 1 && c.status === 'In Sequence').length,
  }));

  // Status distribution for pie chart
  const statusData = [
    { name: 'Unworked', value: unworked, color: 'hsl(215, 16%, 47%)' },
    { name: 'In Sequence', value: inSequence, color: 'hsl(199, 89%, 48%)' },
    { name: 'Warm', value: warm, color: 'hsl(38, 92%, 50%)' },
    { name: 'Hot', value: hot, color: 'hsl(25, 95%, 53%)' },
    { name: 'Disqualified', value: disqualified, color: 'hsl(0, 84%, 60%)' },
  ].filter(d => d.value > 0);

  // Campaign progress
  const campaignStats = campaigns.filter(c => c.active).map(campaign => {
    const campContacts = contacts.filter(c => c.campaignId === campaign.id);
    const avgProgress = campContacts.length > 0
      ? Math.round(campContacts.reduce((acc, c) => acc + getContactProgress(c), 0) / campContacts.length)
      : 0;
    return { name: campaign.name, contacts: campContacts.length, progress: avgProgress };
  });

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-slide-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your outbound pipeline at a glance</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatsCard title="Total Contacts" value={totalContacts} icon={<Users size={18} />} />
          <StatsCard title="In Sequence" value={inSequence} icon={<TrendingUp size={18} />} />
          <StatsCard title="Warm" value={warm} icon={<Target size={18} />} />
          <StatsCard title="Hot / Booked" value={`${hot} / ${meetingsBooked}`} icon={<Flame size={18} />} />
          <StatsCard title="Touches Today" value={touchesToday} icon={<CalendarCheck size={18} />} />
          <StatsCard title="Overdue" value={overdue} icon={<Clock size={18} />} className={overdue > 0 ? 'border-destructive/30' : ''} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Week Distribution */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-4">Contacts by Week</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData}>
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Pie */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-4">Status Breakdown</h3>
            {statusData.length > 0 ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map(d => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-card-foreground">{d.name}</span>
                      <span className="text-muted-foreground">({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Add contacts to see breakdown</p>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-1">Conversion Rate</h3>
            <p className="text-3xl font-bold text-primary">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">{meetingsBooked} meetings from {totalContacts} contacts</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-1">Positive Replies</h3>
            <p className="text-3xl font-bold text-warning">{positiveReplies}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalContacts > 0 ? Math.round((positiveReplies / totalContacts) * 100) : 0}% reply rate</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-1">Active Campaigns</h3>
            <p className="text-3xl font-bold text-foreground">{campaigns.filter(c => c.active).length}</p>
            <p className="text-xs text-muted-foreground mt-1">{campaigns.length} total campaigns</p>
          </div>
        </div>

        {/* Campaign Progress */}
        {campaignStats.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="font-semibold text-sm text-card-foreground mb-4">Campaign Progress</h3>
            <div className="space-y-3">
              {campaignStats.map(cs => (
                <div key={cs.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-card-foreground font-medium">{cs.name}</span>
                    <span className="text-muted-foreground">{cs.contacts} contacts · {cs.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${cs.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
