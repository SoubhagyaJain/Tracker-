'use client';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { activity, dateLabel } from '@/lib/logic';

export function ActivityChart({points,energy=false,planned=false,onDay}:{points:ReturnType<typeof activity>;energy?:boolean;planned?:boolean;onDay?:(day:string)=>void}){
  const tickInterval=Math.max(0,Math.ceil(points.length/6)-1);
  return <div className="area-chart" role="group" aria-label="Focused hours and rolling average. Use the table below analytics for exact values.">
    <ResponsiveContainer width="100%" height="100%" initialDimension={{width:420,height:115}}>
      <ComposedChart data={points} margin={{left:0,right:12,top:8,bottom:0}} onClick={event=>{const date=points[Number(event?.activeTooltipIndex)]?.day;if(date)onDay?.(date);}}>
        <defs><linearGradient id="hours-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#22211e" stopOpacity=".30"/><stop offset="100%" stopColor="#22211e" stopOpacity=".02"/></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="rgba(20,20,20,.12)" strokeDasharray="2 4"/>
        <XAxis dataKey="day" tickFormatter={day=>dateLabel(day,'d MMM')} tickLine={false} axisLine={false} interval={tickInterval} tickMargin={8} tick={{fontSize:10,fill:'#56534d'}}/>
        <YAxis width={25} yAxisId="hours" domain={[0,(max:number)=>Math.max(2,Math.ceil(max))]} tickLine={false} axisLine={false} tick={{fontSize:10,fill:'#56534d'}}/>
        {energy&&<YAxis hide orientation="right" yAxisId="energy" domain={[0,5]}/>}
        <Tooltip labelFormatter={day=>dateLabel(String(day),'d MMM yyyy')} formatter={(value,name)=>[typeof value==='number'?Number(value.toFixed(2)):value,name]} contentStyle={{background:'#f8f7f4',border:'1px solid #ddd9d2',borderRadius:12,fontSize:12}} />
        {planned&&<Line yAxisId="hours" type="monotone" dataKey="planned" name="Planned hours" stroke="#777169" dot={false} strokeDasharray="2 4" isAnimationActive={false}/>}
        <Area yAxisId="hours" type="monotone" dataKey="hours" name="Focused hours" fill="url(#hours-fill)" stroke="#211f1b" strokeWidth={2} isAnimationActive={false}/>
        <Line yAxisId="hours" type="monotone" dataKey="average" name="7-day average" stroke="#8a8378" strokeDasharray="5 4" dot={false} isAnimationActive={false}/>
        {energy&&<><Line yAxisId="energy" type="monotone" dataKey="energy" name="Energy / 5" stroke="#6f7868" dot={{r:3}} isAnimationActive={false}/><Line yAxisId="energy" type="monotone" dataKey="focus" name="Focus / 5" stroke="#92774a" dot={{r:3}} isAnimationActive={false}/></>}
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}

