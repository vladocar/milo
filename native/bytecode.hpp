// Milo 0.3 bytecode compiler and stack VM.
// Included inside namespace milo, after the shared parser/value/runtime helpers.
#ifndef MILO_BYTECODE_HPP
#define MILO_BYTECODE_HPP

struct Symbols {
    std::vector<std::string> names;
    std::unordered_map<std::string,int> ids;
    int intern(const std::string& name) {
        auto found=ids.find(name);
        if (found!=ids.end()) return found->second;
        int id=static_cast<int>(names.size()); names.push_back(name); ids.emplace(name,id); return id;
    }
};
#define MILO_OPS(X) \
    X(Constant) X(LoadGlobal) X(StoreGlobal) X(LoadLocal) X(StoreLocal) X(LoadOuter) \
    X(Pop) X(BuildList) X(NewDict) X(DictPut) X(Index) X(SetIndex) \
    X(Add) X(Subtract) X(Multiply) X(Divide) X(FloorDivide) X(Modulo) X(Power) \
    X(Negate) X(Positive) X(Not) X(Compare) X(ChainCompare) \
    X(Jump) X(JumpFalse) X(And) X(Or) X(IterInit) X(RepeatInit) X(IterNext) X(IterClear) \
    X(MakeFunction) X(Call) X(Return) X(Say) X(Halt)
enum class Op : std::uint8_t {
#define MILO_ENUM(name) name,
    MILO_OPS(MILO_ENUM)
#undef MILO_ENUM
};
const char* opname(Op op) {
    switch (op) {
#define MILO_NAME(name) case Op::name: return #name;
        MILO_OPS(MILO_NAME)
#undef MILO_NAME
    }
    return "Unknown";
}
#undef MILO_OPS
// Fixed-width instruction records: one-byte opcode, integer operands, source line.
// This release keeps bytecode in memory; it does not load untrusted bytecode files.
struct Instruction { Op op; int a=0, b=0, line=0; };
struct Code {
    std::string name;
    bool top=false;
    int iterators=0, max_stack=0;
    std::vector<int> locals;
    std::unordered_map<int,int> local_index;
    std::vector<int> params;
    std::vector<Instruction> instructions;
    std::vector<Value> constants;
    std::vector<std::shared_ptr<Code>> functions;
};
// Verify compiler output before dispatch: no underflow, invalid targets, or
// inconsistent operand depths at control-flow joins. Bytecode has no public loader.
void verify_code(const std::shared_ptr<Code>& code,int symbol_count) {
    const auto& ops=code->instructions;
    std::vector<int> depths(ops.size(),-1), work;
    auto edge=[&](int target,int depth) {
        if (target<0 || static_cast<std::size_t>(target)>=ops.size() || depth<0)
            throw Error("Internal compiler error: invalid control flow.");
        auto& known=depths[static_cast<std::size_t>(target)];
        if (known!=-1 && known!=depth) throw Error("Internal compiler error: inconsistent stack depth.");
        if (known==-1) { known=depth; work.push_back(target); }
        code->max_stack=std::max(code->max_stack,depth);
    };
    edge(0,0);
    auto index=[](int value,std::size_t size) { if (value<0 || static_cast<std::size_t>(value)>=size) throw Error("Internal compiler error: invalid operand index."); };
    while (!work.empty()) {
        int pc=work.back(); work.pop_back(); const auto& i=ops[static_cast<std::size_t>(pc)]; int depth=depths[static_cast<std::size_t>(pc)];
        int need=0,delta=0; bool terminal=false;
        switch (i.op) {
        case Op::Constant: index(i.a,code->constants.size()); delta=1; break;
        case Op::LoadGlobal: case Op::LoadOuter: index(i.a,static_cast<std::size_t>(symbol_count)); delta=1; break;
        case Op::StoreGlobal: index(i.a,static_cast<std::size_t>(symbol_count)); need=1; delta=-1; break;
        case Op::LoadLocal: index(i.a,code->locals.size()); delta=1; break;
        case Op::StoreLocal: index(i.a,code->locals.size()); need=1; delta=-1; break;
        case Op::Pop: need=1; delta=-1; break;
        case Op::BuildList: if (i.a<0) throw Error("Internal compiler error: negative item count."); need=i.a; delta=1-i.a; break;
        case Op::NewDict: delta=1; break;
        case Op::DictPut: need=3; delta=-2; break;
        case Op::Index: need=2; delta=-1; break;
        case Op::SetIndex: need=3; delta=-3; break;
        case Op::Add: case Op::Subtract: case Op::Multiply: case Op::Divide: case Op::FloorDivide: case Op::Modulo: case Op::Power: need=2; delta=-1; break;
        case Op::Negate: case Op::Positive: case Op::Not: need=1; break;
        case Op::Compare: index(i.a,7); need=2; delta=-1; break;
        case Op::ChainCompare: index(i.a,7); need=2; delta=-1; edge(i.b,depth-1); break;
        case Op::Jump: edge(i.a,depth); terminal=true; break;
        case Op::JumpFalse: need=1; delta=-1; edge(i.a,depth-1); break;
        case Op::And: case Op::Or: need=1; delta=-1; edge(i.a,depth); break;
        case Op::IterInit: case Op::RepeatInit: index(i.a,static_cast<std::size_t>(code->iterators)); need=1; delta=-1; break;
        case Op::IterNext: index(i.a,static_cast<std::size_t>(code->iterators)); edge(i.b,depth); delta=1; break;
        case Op::IterClear: index(i.a,static_cast<std::size_t>(code->iterators)); break;
        case Op::MakeFunction: index(i.a,code->functions.size()); delta=1; break;
        case Op::Call: if (i.a<0) throw Error("Internal compiler error: negative argument count."); need=i.a+1; delta=-i.a; break;
        case Op::Return: if (depth!=1 || code->top) throw Error("Internal compiler error: invalid return stack."); terminal=true; break;
        case Op::Say: if (i.a<0) throw Error("Internal compiler error: negative output count."); need=i.a; delta=-i.a; break;
        case Op::Halt: if (depth!=0 || !code->top) throw Error("Internal compiler error: invalid halt stack."); terminal=true; break;
        }
        if (depth<need) throw Error("Internal compiler error: operand stack underflow.");
        if (!terminal) edge(pc+1,depth+delta);
    }
}
const std::vector<std::string> comparison_ops={"==","!=","<","<=",">",">=","in"};
int comparison_id(const std::string& op) {
    if (op=="is") return 0;
    for (std::size_t i=0;i<comparison_ops.size();++i) if (comparison_ops[i]==op) return static_cast<int>(i);
    throw Error("Unknown comparison operator.");
}
class Compiler {
    Symbols& symbols;
    std::shared_ptr<Code> code=std::make_shared<Code>();
    int line=0, expression_depth=0;
    struct Loop { int head, iterator; std::vector<int> breaks; };
    std::vector<Loop> loops;
    int here() const { return static_cast<int>(code->instructions.size()); }
    int emit(Op op,int a=0,int b=0) {
        int at=here(); code->instructions.push_back({op,a,b,line}); return at;
    }
    void patch(int at,int target) {
        auto& instruction=code->instructions[static_cast<std::size_t>(at)];
        if (instruction.op==Op::ChainCompare || instruction.op==Op::IterNext) instruction.b=target;
        else instruction.a=target;
    }
    void constant(Value value) {
        int index=static_cast<int>(code->constants.size()); code->constants.push_back(std::move(value)); emit(Op::Constant,index);
    }
    int local(int symbol) {
        auto found=code->local_index.find(symbol);
        if (found!=code->local_index.end()) return found->second;
        int index=static_cast<int>(code->locals.size()); code->locals.push_back(symbol); code->local_index.emplace(symbol,index); return index;
    }
    void assignments(const Block& nodes) {
        for (const auto& s:nodes) {
            if (s->kind==SK::Assign && s->expressions[0]->kind==EK::Name) local(symbols.intern(s->expressions[0]->text));
            if (s->kind==SK::Function) { local(symbols.intern(s->name)); continue; }
            if ((s->kind==SK::Repeat || s->kind==SK::For) && !s->name.empty()) local(symbols.intern(s->name));
            assignments(s->body); assignments(s->otherwise);
            for (const auto& branch:s->branches) assignments(branch.second);
        }
    }
    void load(const std::string& name) {
        int id=symbols.intern(name);
        if (code->top) emit(Op::LoadGlobal,id);
        else {
            auto found=code->local_index.find(id);
            if (found==code->local_index.end()) emit(Op::LoadOuter,id);
            else emit(Op::LoadLocal,found->second);
        }
    }
    void store(const std::string& name) {
        int id=symbols.intern(name);
        emit(code->top ? Op::StoreGlobal : Op::StoreLocal,code->top ? id : local(id));
    }
    void expression(const EP& p) {
        struct Guard { int& n; explicit Guard(int& d):n(d){ if (n>=512) throw Error("Expression is nested too deeply."); ++n; } ~Guard(){--n;} } guard(expression_depth);
        const auto& k=p->kids;
        switch (p->kind) {
        case EK::Literal: constant(p->value); break;
        case EK::Name: load(p->text); break;
        case EK::List:
            for (const auto& e:k) expression(e);
            emit(Op::BuildList,static_cast<int>(k.size())); break;
        case EK::Dict:
            emit(Op::NewDict);
            // Insert each pair immediately, preserving exception/side-effect order.
            for (std::size_t i=0;i<k.size();i+=2) { expression(k[i]); expression(k[i+1]); emit(Op::DictPut); }
            break;
        case EK::Index: expression(k[0]); expression(k[1]); emit(Op::Index); break;
        case EK::Unary: expression(k[0]); emit(p->text=="not" ? Op::Not : p->text=="-" ? Op::Negate : Op::Positive); break;
        case EK::Binary:
            expression(k[0]);
            if (p->text=="and" || p->text=="or") {
                int branch=emit(p->text=="and" ? Op::And : Op::Or); expression(k[1]); patch(branch,here());
            } else {
                expression(k[1]);
                const auto& op=p->text;
                emit(op=="+" ? Op::Add : op=="-" ? Op::Subtract : op=="*" ? Op::Multiply : op=="/" ? Op::Divide : op=="//" ? Op::FloorDivide : op=="%" ? Op::Modulo : Op::Power);
            }
            break;
        case EK::Compare: {
            expression(k[0]); std::vector<int> short_circuits;
            for (std::size_t i=0;i<p->ops.size();++i) {
                expression(k[i+1]);
                if (i+1==p->ops.size()) emit(Op::Compare,comparison_id(p->ops[i]));
                else short_circuits.push_back(emit(Op::ChainCompare,comparison_id(p->ops[i])));
            }
            for (int at:short_circuits) patch(at,here());
            break;
        }
        case EK::Call:
            for (const auto& e:k) expression(e);
            emit(Op::Call,static_cast<int>(k.size())-1); break;
        }
    }
    void statement(const SP& s) {
        line=s->line;
        const auto& a=s->expressions;
        switch (s->kind) {
        case SK::Say:
            for (const auto& e:a) expression(e);
            emit(Op::Say,static_cast<int>(a.size())); break;
        case SK::Assign:
            expression(a[1]);
            if (a[0]->kind==EK::Name) store(a[0]->text);
            else { expression(a[0]->kids[0]); expression(a[0]->kids[1]); emit(Op::SetIndex); }
            break;
        case SK::Expression: expression(a[0]); emit(Op::Pop); break;
        case SK::Function: {
            auto body=Compiler(symbols).compile(s->body,s->name,s->params,false,s->line);
            int index=static_cast<int>(code->functions.size()); code->functions.push_back(std::move(body));
            emit(Op::MakeFunction,index); store(s->name); break;
        }
        case SK::If: {
            std::vector<int> exits;
            for (const auto& branch:s->branches) {
                line=s->line; expression(branch.first); int otherwise=emit(Op::JumpFalse);
                block(branch.second); line=s->line; exits.push_back(emit(Op::Jump)); patch(otherwise,here());
            }
            block(s->otherwise);
            for (int exit:exits) patch(exit,here());
            break;
        }
        case SK::While: {
            int head=here(); expression(a[0]); int exit=emit(Op::JumpFalse);
            loops.push_back({head,-1,{}}); block(s->body); line=s->line; emit(Op::Jump,head);
            auto loop=std::move(loops.back()); loops.pop_back(); patch(exit,here());
            for (int at:loop.breaks) patch(at,here());
            break;
        }
        case SK::Repeat: case SK::For: {
            expression(a[0]); int iterator=code->iterators++;
            emit(s->kind==SK::Repeat ? Op::RepeatInit : Op::IterInit,iterator);
            int head=here(); int exit=emit(Op::IterNext,iterator);
            if (s->name.empty()) emit(Op::Pop); else store(s->name);
            loops.push_back({head,iterator,{}}); block(s->body); line=s->line; emit(Op::Jump,head);
            auto loop=std::move(loops.back()); loops.pop_back(); patch(exit,here());
            for (int at:loop.breaks) patch(at,here());
            break;
        }
        case SK::Return: expression(a[0]); emit(Op::Return); break;
        case SK::Break:
            if (loops.empty()) throw Error("Use break inside a loop.");
            if (loops.back().iterator>=0) emit(Op::IterClear,loops.back().iterator);
            loops.back().breaks.push_back(emit(Op::Jump)); break;
        case SK::Continue:
            if (loops.empty()) throw Error("Use continue inside a loop.");
            emit(Op::Jump,loops.back().head); break;
        }
    }
    void block(const Block& nodes) {
        for (const auto& s:nodes) {
            try { statement(s); } catch (Error& e) { if (!e.line) e.line=s->line; throw; }
        }
    }
public:
    explicit Compiler(Symbols& names):symbols(names){}
    std::shared_ptr<Code> compile(const Block& nodes,std::string name="<main>",const std::vector<std::string>& params={},bool top=true,int definition_line=0) {
        code->name=std::move(name); code->top=top; line=definition_line;
        if (!top) {
            for (const auto& param:params) code->params.push_back(local(symbols.intern(param)));
            assignments(nodes);
        }
        block(nodes);
        if (top) emit(Op::Halt);
        else { constant(Value()); emit(Op::Return); }
        verify_code(code,static_cast<int>(symbols.names.size()));
        return code;
    }
};
struct VMEnv {
    std::shared_ptr<Code> layout;
    std::shared_ptr<VMEnv> parent;
    std::vector<Value> slots;
    std::vector<std::uint8_t> bound;
    bool registered=false;
    explicit VMEnv(std::shared_ptr<Code> code=nullptr,std::shared_ptr<VMEnv> outer=nullptr):layout(std::move(code)),parent(std::move(outer)) {
        if (layout) { slots.resize(layout->locals.size()); bound.resize(slots.size(),0); }
    }
    Value get(int id,const Symbols& symbols) const {
        if (!layout) {
            if (static_cast<std::size_t>(id)<bound.size() && bound[static_cast<std::size_t>(id)]) return slots[static_cast<std::size_t>(id)];
        } else {
            auto found=layout->local_index.find(id);
            if (found!=layout->local_index.end() && bound[static_cast<std::size_t>(found->second)]) return slots[static_cast<std::size_t>(found->second)];
        }
        if (parent) return parent->get(id,symbols);
        throw Error("I do not know '"+symbols.names[static_cast<std::size_t>(id)]+"'. Set it before using it.");
    }
};
void disassemble(const std::shared_ptr<Code>& code,const Symbols& symbols,int indent=0) {
    std::string pad(static_cast<std::size_t>(indent),' ');
    std::cout<<pad<<"== "<<code->name<<" ("<<code->locals.size()<<" local slots) ==\n";
    for (std::size_t pc=0;pc<code->instructions.size();++pc) {
        const auto& i=code->instructions[pc];
        std::cout<<pad<<std::setw(4)<<pc<<"  line "<<std::setw(3)<<i.line<<"  "<<std::left<<std::setw(14)<<opname(i.op)<<std::right<<i.a<<' '<<i.b;
        if (i.op==Op::Constant) std::cout<<"  "<<display(code->constants[static_cast<std::size_t>(i.a)],true);
        if (i.op==Op::LoadGlobal || i.op==Op::StoreGlobal || i.op==Op::LoadOuter) std::cout<<"  "<<symbols.names[static_cast<std::size_t>(i.a)];
        if (i.op==Op::LoadLocal || i.op==Op::StoreLocal) std::cout<<"  "<<symbols.names[static_cast<std::size_t>(code->locals[static_cast<std::size_t>(i.a)])];
        if (i.op==Op::Compare || i.op==Op::ChainCompare) std::cout<<"  "<<comparison_ops[static_cast<std::size_t>(i.a)];
        std::cout<<'\n';
    }
    for (const auto& child:code->functions) disassemble(child,symbols,indent+2);
}
class VMRuntime : public Runtime {
    struct Frame {
        std::shared_ptr<Code> code;
        std::shared_ptr<VMEnv> env;
        std::size_t pc=0, base=0;
        std::vector<std::optional<Iterator>> iterators;
        Frame(std::shared_ptr<Code> c,std::shared_ptr<VMEnv> e,std::size_t b):code(std::move(c)),env(std::move(e)),base(b),iterators(static_cast<std::size_t>(code->iterators)){}
    };
    std::vector<std::weak_ptr<VMEnv>> captures;
    void capture(const std::shared_ptr<VMEnv>& env) {
        if (!env->registered) { env->registered=true; captures.push_back(env); }
    }
    static Value pop(std::vector<Value>& stack) {
        Value value=std::move(stack.back()); stack.pop_back(); return value;
    }
    static void binary(std::vector<Value>& stack,Op op) {
        auto right=pop(stack); auto& left=stack.back();
        if (left.is<I>() && right.is<I>()) {
            I x=left.get<I>(), y=right.get<I>();
            if (op==Op::Add) { left=Value(checked_add(x,y)); return; }
            if (op==Op::Subtract) { left=Value(checked_sub(x,y)); return; }
            if (op==Op::Multiply) { left=Value(checked_mul(x,y)); return; }
        }
        const char* name=op==Op::Add ? "+" : op==Op::Subtract ? "-" : op==Op::Multiply ? "*" : op==Op::Divide ? "/" : op==Op::FloorDivide ? "//" : op==Op::Modulo ? "%" : "**";
        left=arithmetic(name,left,right);
    }
public:
    Symbols symbols;
    std::shared_ptr<VMEnv> global=std::make_shared<VMEnv>();
    explicit VMRuntime(I limit):Runtime(limit) {
        for (const auto& entry:globals->values) {
            int id=symbols.intern(entry.first);
            global->slots.resize(symbols.names.size()); global->bound.resize(symbols.names.size(),0);
            global->slots[static_cast<std::size_t>(id)]=entry.second; global->bound[static_cast<std::size_t>(id)]=1;
        }
    }
    ~VMRuntime() {
        std::vector<std::shared_ptr<VMEnv>> live;
        for (const auto& weak:captures) if (auto env=weak.lock()) live.push_back(std::move(env));
        for (const auto& env:live) { env->slots.clear(); env->bound.clear(); }
    }
    std::shared_ptr<Code> compile(const Block& nodes) { return Compiler(symbols).compile(nodes); }
    void run(const Block& nodes) { run(compile(nodes)); }
    void run(const std::shared_ptr<Code>& code) {
        steps=0;
        global->slots.resize(symbols.names.size()); global->bound.resize(symbols.names.size(),0);
        std::vector<Value> stack; stack.reserve(static_cast<std::size_t>(std::max(256,code->max_stack)));
        std::vector<Frame> frames; frames.reserve(129); frames.emplace_back(code,global,0);
        int current_line=0;
        try {
            while (!frames.empty()) {
                auto& f=frames.back();
                const auto i=f.code->instructions[f.pc++]; current_line=i.line; tick();
                switch (i.op) {
                case Op::Constant: stack.push_back(f.code->constants[static_cast<std::size_t>(i.a)]); break;
                case Op::LoadGlobal:
                    if (!global->bound[static_cast<std::size_t>(i.a)]) throw Error("I do not know '"+symbols.names[static_cast<std::size_t>(i.a)]+"'. Set it before using it.");
                    stack.push_back(global->slots[static_cast<std::size_t>(i.a)]); break;
                case Op::StoreGlobal:
                    global->slots[static_cast<std::size_t>(i.a)]=pop(stack); global->bound[static_cast<std::size_t>(i.a)]=1; break;
                case Op::LoadLocal:
                    if (f.env->bound[static_cast<std::size_t>(i.a)]) stack.push_back(f.env->slots[static_cast<std::size_t>(i.a)]);
                    else stack.push_back(f.env->parent->get(f.code->locals[static_cast<std::size_t>(i.a)],symbols));
                    break;
                case Op::StoreLocal:
                    f.env->slots[static_cast<std::size_t>(i.a)]=pop(stack); f.env->bound[static_cast<std::size_t>(i.a)]=1; break;
                case Op::LoadOuter: stack.push_back(f.env->parent->get(i.a,symbols)); break;
                case Op::Pop: stack.pop_back(); break;
                case Op::BuildList: {
                    std::size_t first=stack.size()-static_cast<std::size_t>(i.a);
                    auto list=std::make_shared<List>(); list->values.reserve(static_cast<std::size_t>(i.a));
                    for (std::size_t n=first;n<stack.size();++n) list->values.push_back(std::move(stack[n]));
                    stack.resize(first); stack.emplace_back(list); break;
                }
                case Op::NewDict: stack.emplace_back(std::make_shared<Dict>()); break;
                case Op::DictPut: {
                    auto value=pop(stack), key=pop(stack); dict_set(stack.back().get<std::shared_ptr<Dict>>(),std::move(key),std::move(value)); break;
                }
                case Op::Index: { auto key=pop(stack); stack.back()=indexed(stack.back(),key); break; }
                case Op::SetIndex: { auto key=pop(stack), object=pop(stack), value=pop(stack); set_index(object,key,std::move(value)); break; }
                case Op::Add: case Op::Subtract: case Op::Multiply: case Op::Divide: case Op::FloorDivide: case Op::Modulo: case Op::Power: binary(stack,i.op); break;
                case Op::Negate: case Op::Positive: {
                    auto& v=stack.back(); if (!numeric(v)) throw Error("Unary + or - needs a number.");
                    if (i.op==Op::Negate) v=v.is<double>() ? floating(-real(v)) : Value(checked_sub(0,integer(v)));
                    else if (v.is<bool>()) v=Value(integer(v));
                    break;
                }
                case Op::Not: stack.back()=Value(!truth(stack.back())); break;
                case Op::Compare: case Op::ChainCompare: {
                    auto right=pop(stack); auto& left=stack.back();
                    bool result=compare(comparison_ops[static_cast<std::size_t>(i.a)],left,right);
                    if (i.op==Op::Compare) left=Value(result);
                    else if (result) left=std::move(right);
                    else { left=Value(false); f.pc=static_cast<std::size_t>(i.b); }
                    break;
                }
                case Op::Jump: f.pc=static_cast<std::size_t>(i.a); break;
                case Op::JumpFalse: { auto value=pop(stack); if (!truth(value)) f.pc=static_cast<std::size_t>(i.a); break; }
                case Op::And: case Op::Or: {
                    bool value=truth(stack.back());
                    if (i.op==Op::And ? !value : value) f.pc=static_cast<std::size_t>(i.a);
                    else stack.pop_back();
                    break;
                }
                case Op::IterInit: case Op::RepeatInit: {
                    auto value=pop(stack); bool empty=false;
                    if (i.op==Op::RepeatInit) {
                        if (!value.is<I>() || value.get<I>()<0) throw Error("repeat needs a whole number of 0 or more.");
                        I count=value.get<I>(); empty=count==0; value=Value(Range{1,empty ? 1 : count,1});
                    }
                    auto& iter=f.iterators[static_cast<std::size_t>(i.a)]; iter.emplace(std::move(value)); if (empty) iter->done=true;
                    break;
                }
                case Op::IterNext: {
                    auto& iter=f.iterators[static_cast<std::size_t>(i.a)]; Value value;
                    if (iter->next(value)) stack.push_back(std::move(value));
                    else { iter.reset(); f.pc=static_cast<std::size_t>(i.b); }
                    break;
                }
                case Op::IterClear: f.iterators[static_cast<std::size_t>(i.a)].reset(); break;
                case Op::MakeFunction: {
                    capture(f.env); auto fn=std::make_shared<Function>(); fn->bytecode=f.code->functions[static_cast<std::size_t>(i.a)];
                    fn->name=fn->bytecode->name; fn->capture=f.env; stack.emplace_back(fn); break;
                }
                case Op::Call: {
                    std::size_t base=stack.size()-static_cast<std::size_t>(i.a)-1;
                    Value function=stack[base];
                    if (function.is<Builtin>()) {
                        std::vector<Value> args; args.reserve(static_cast<std::size_t>(i.a));
                        for (std::size_t at=base+1;at<stack.size();++at) args.push_back(std::move(stack[at]));
                        stack.resize(base); stack.push_back(builtin(function.get<Builtin>().name,args));
                    } else {
                        if (!function.is<std::shared_ptr<Function>>()) throw Error("This value is not a function.");
                        auto fn=function.get<std::shared_ptr<Function>>();
                        if (!fn->bytecode) throw Error("Cannot call a tree function from the bytecode VM.");
                        if (static_cast<std::size_t>(i.a)!=fn->bytecode->params.size()) throw Error(fn->name+" needs "+std::to_string(fn->bytecode->params.size())+" values; got "+std::to_string(i.a)+".");
                        if (frames.size()>=129) throw Error("Too many nested function calls (limit 128).");
                        auto env=std::make_shared<VMEnv>(fn->bytecode,fn->capture);
                        for (int n=0;n<i.a;++n) { auto slot=static_cast<std::size_t>(fn->bytecode->params[static_cast<std::size_t>(n)]); env->slots[slot]=std::move(stack[base+1+static_cast<std::size_t>(n)]); env->bound[slot]=1; }
                        stack.resize(base); frames.emplace_back(fn->bytecode,std::move(env),base);
                    }
                    break;
                }
                case Op::Return: {
                    auto result=pop(stack); auto base=f.base; frames.pop_back(); stack.resize(base); stack.push_back(std::move(result)); break;
                }
                case Op::Say: {
                    std::size_t first=stack.size()-static_cast<std::size_t>(i.a);
                    for (std::size_t n=first;n<stack.size();++n) { if (n>first) std::cout<<' '; std::cout<<display(stack[n]); }
                    std::cout<<'\n'; stack.resize(first); break;
                }
                case Op::Halt:
                    if (!stack.empty()) throw Error("Internal VM error: unbalanced operand stack.");
                    frames.pop_back(); break;
                }
            }
        } catch (Error& e) { if (!e.line) e.line=current_line; throw; }
    }
};
#endif
