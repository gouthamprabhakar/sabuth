'use client';
import {useState,useEffect} from 'react';
import {CalendarDays} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {displayDate,parseDisplayDate,validDate} from '@/lib/domain';
export function DateInput({value,onChange,label,disabled=false,invalid=false}:{value:string;onChange:(value:string)=>void;label:string;disabled?:boolean;invalid?:boolean}){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState(validDate(value)?displayDate(value):value);
 useEffect(()=>setDraft(validDate(value)?displayDate(value):value),[value]);
 const selected=validDate(value)?new Date(value+'T12:00:00'):undefined;
 return <div className="date-input-control">
  <Input aria-label={label} aria-invalid={invalid} disabled={disabled} inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10} value={draft} onChange={event=>{const text=event.target.value;setDraft(text);onChange(parseDisplayDate(text)||text)}}/>
  <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={'Choose '+label}><CalendarDays size={17}/></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={selected} defaultMonth={selected} captionLayout="label" onSelect={day=>{if(day){onChange(`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`);setOpen(false)}}}/></PopoverContent></Popover>
 </div>;
}
