#include <emscripten.h>
#include <cstdlib>
#include <sstream>
#define main milo_unused_main
#include "milo.cpp"
#undef main

EM_JS(void, host_emit, (const char* type,const char* json), {
    self.MiloHost.emit(UTF8ToString(type), JSON.parse(UTF8ToString(json)));
});
EM_ASYNC_JS(void, host_trace, (int line,const char* variables), {
    await self.MiloHost.trace(line, JSON.parse(UTF8ToString(variables)));
});
EM_ASYNC_JS(char*, host_ask, (const char* prompt), {
    const answer=await self.MiloHost.ask(UTF8ToString(prompt));
    var size=lengthBytesUTF8(answer)+1,ptr=_malloc(size);stringToUTF8(answer,ptr,size);return ptr;
});
EM_ASYNC_JS(void, host_wait, (double seconds), {
    await self.MiloHost.wait(seconds);
});
EM_ASYNC_JS(char*, host_key, (), {
    var answer=await self.MiloHost.key();
    var size=lengthBytesUTF8(answer)+1,ptr=_malloc(size);stringToUTF8(answer,ptr,size);return ptr;
});
EM_JS(double, host_random, (), {
    return self.MiloHost.random();
});
namespace milo {
std::string json_string(const std::string& text) {
    std::string out="\"";
    for (unsigned char c:text) {
        if (c=='"') out+="\\\"";
        else if (c=='\\') out+="\\\\";
        else if (c=='\n') out+="\\n";
        else if (c=='\r') out+="\\r";
        else if (c=='\t') out+="\\t";
        else if (c<32) { const char* hex="0123456789abcdef"; out+="\\u00"; out+=hex[c>>4]; out+=hex[c&15]; }
        else out+=static_cast<char>(c);
    }
    return out+'"';
}
std::string playground_ask(const std::string& prompt) {
    char* ptr=host_ask(prompt.c_str());
    std::string result(ptr); std::free(ptr); return result;
}
int sprite_count=0;
void validate_color(const Value& value) {
    const auto& color=string(value);
    static const std::unordered_set<std::string> colors={"blue","teal","green","red","purple","pink","orange","yellow","black","white","navy","brown","coral","gold","turquoise","lime","indigo","violet","cyan","magenta","gray","grey","darkgreen","skyblue","tomato","lavender","salmon"};
    bool hex=(color.size()==4 || color.size()==7) && color[0]=='#' && std::all_of(color.begin()+1,color.end(),[](unsigned char c){return std::isxdigit(c)!=0;});
    if (!colors.count(color) && !hex) throw Error("Try a color such as blue, teal, purple, or #ff8800.");
}
std::shared_ptr<Sprite> sprite_arg(const Value& value) {
    if (!value.is<std::shared_ptr<Sprite>>()) throw Error("Use a sprite here, like player = sprite(\"turtle\").");
    return value.get<std::shared_ptr<Sprite>>();
}
double sprite_number(const Value& value) {
    if (!numeric(value) || value.is<bool>()) throw Error("Sprite positions need numbers.");
    double n=real(value);
    if (!std::isfinite(n) || std::fabs(n)>10000) throw Error("Use a sprite number between -10000 and 10000.");
    return n;
}
void emit_sprite(const std::shared_ptr<Sprite>& sprite) {
    std::ostringstream out;
    out<<"{\"name\":\"sprite_state\",\"args\":["<<sprite->id<<","<<json_string(sprite->shape)<<","<<json_string(sprite->color)<<","<<sprite->x<<","<<sprite->y<<","<<(sprite->visible?"true":"false")<<"]}";
    host_emit("draw",out.str().c_str());
}
Value playground_builtin(const std::string& name,const std::vector<Value>& args) {
    if (name=="random") {
        if (args.size()!=2) throw Error("random needs a minimum and a maximum.");
        for (const auto& value:args) if (!value.is<I>() || value.get<I>() < -1000000 || value.get<I>() > 1000000) throw Error("random needs whole numbers from -1000000 to 1000000.");
        I low=args[0].get<I>(),high=args[1].get<I>();
        if (low>high) throw Error("Put the smaller number first in random(min, max).");
        return Value(low+static_cast<I>(std::floor(host_random()*static_cast<double>(high-low+1))));
    }
    if (name=="play_note") {
        if (args.size()!=2) throw Error("play_note needs a note number and seconds.");
        if (!args[0].is<I>() || args[0].get<I>()<48 || args[0].get<I>()>84) throw Error("Choose a whole note number from 48 to 84. Try 60 for middle C.");
        if (!numeric(args[1]) || args[1].is<bool>()) throw Error("Use a note duration from 0.05 to 2 seconds.");
        double seconds=real(args[1]);
        if (!std::isfinite(seconds) || seconds<0.05 || seconds>2) throw Error("Use a note duration from 0.05 to 2 seconds.");
        std::ostringstream payload;payload<<"{\"note\":"<<args[0].get<I>()<<",\"seconds\":"<<seconds<<"}";
        host_emit("note",payload.str().c_str());host_wait(seconds);return Value();
    }
    if (name=="show_score") {
        if (args.size()!=1 || !args[0].is<I>() || args[0].get<I>()<0 || args[0].get<I>()>1000000) throw Error("show_score needs one whole number from 0 to 1000000.");
        host_emit("score",std::to_string(args[0].get<I>()).c_str());return Value();
    }
    if (name=="sprite") {
        if (args.size()<1 || args.size()>2) throw Error("sprite needs a shape and an optional color.");
        const auto& shape=string(args[0]);
        if (shape!="turtle" && shape!="star" && shape!="circle" && shape!="square") throw Error("Choose a sprite shape: turtle, star, circle, or square.");
        if (args.size()==2) validate_color(args[1]);
        if (sprite_count>=64) throw Error("This playground can make up to 64 sprites per run.");
        const std::string color=args.size()==2?string(args[1]):shape=="star"?"gold":shape=="square"?"purple":shape=="circle"?"coral":"teal";
        auto sprite=std::make_shared<Sprite>(Sprite{++sprite_count,shape,color});emit_sprite(sprite);return Value(sprite);
    }
    if (name=="place" || name=="shift" || name=="hide" || name=="show" || name=="touching" || (name=="color" && args.size()==2)) {
        std::size_t count=name=="place" || name=="shift"?3:name=="touching" || name=="color"?2:1;
        if (args.size()!=count) throw Error(name+" needs "+std::to_string(count)+" values.");
        auto sprite=sprite_arg(args[0]);
        if (name=="touching") {
            auto other=sprite_arg(args[1]);
            return Value(sprite->visible && other->visible && std::hypot(sprite->x-other->x,sprite->y-other->y)<=40);
        }
        if (name=="place" || name=="shift") {
            double x=sprite_number(args[1]),y=sprite_number(args[2]);
            if (name=="shift") { x+=sprite->x;y+=sprite->y; }
            sprite->x=std::clamp(x,-230.0,230.0);sprite->y=std::clamp(y,-230.0,230.0);
        } else if (name=="color") { validate_color(args[1]);sprite->color=string(args[1]); }
        else sprite->visible=name=="show";
        emit_sprite(sprite);return Value();
    }
    if (name=="wait") {
        if (args.size()!=1) throw Error("wait needs 1 values.");
        if (!numeric(args[0])) throw Error("wait needs a number of seconds from 0 to 60.");
        double seconds=real(args[0]);
        if (!std::isfinite(seconds) || seconds<0 || seconds>60) throw Error("wait needs a number of seconds from 0 to 60.");
        host_wait(seconds); return Value();
    }
    if (name=="key") {
        if (!args.empty()) throw Error("key needs 0 values.");
        char* ptr=host_key(); std::string result(ptr); std::free(ptr); return Value(result);
    }
    static const std::unordered_set<std::string> commands={"move","turn","color","width","pen_up","pen_down","home","clear","circle","background","write","go_to","dot","fill","no_fill","rectangle","polygon"};
    if (!commands.count(name)) throw Error("I do not know the drawing command '"+name+"'.");
    bool empty=name=="pen_up" || name=="pen_down" || name=="home" || name=="clear" || name=="no_fill";
    std::size_t count=empty ? 0 : (name=="go_to" || name=="rectangle" || name=="polygon") ? 2 : 1;
    if (args.size()!=count) throw Error(name+" needs "+std::to_string(count)+" values.");
    if (name=="move" || name=="turn" || name=="width" || name=="circle" || name=="go_to" || name=="dot" || name=="rectangle" || name=="polygon") {
        for (std::size_t i=0;i<args.size();++i) {
            double value=real(args[i]);
            if (!std::isfinite(value) || std::fabs(value)>10000) throw Error("Use a drawing number between -10000 and 10000.");
            bool positive=name=="width" || name=="circle" || name=="dot" || name=="rectangle" || (name=="polygon" && i==1);
            if (positive && value<=0) throw Error(name+" needs sizes greater than zero.");
        }
        if (name=="polygon" && (!args[0].is<I>() || args[0].get<I>()<3 || args[0].get<I>()>36)) throw Error("polygon needs a whole number of sides from 3 to 36.");
    }
    if (name=="color" || name=="background" || name=="fill") validate_color(args[0]);
    std::string payload="{\"name\":"+json_string(name)+",\"args\":[";
    for (std::size_t i=0;i<args.size();++i) {
        if (i) payload+=',';
        if (name=="write" || args[i].is<std::string>()) payload+=json_string(display(args[i]));
        else payload+=display(args[i]);
    }
    payload+="]}"; host_emit("draw",payload.c_str()); return Value();
}
std::string snapshot(std::shared_ptr<VMEnv> env,const Symbols& symbols) {
    std::unordered_set<int> seen; std::string out="["; bool first=true; int count=0;
    for (;env;env=env->parent) {
        for (std::size_t i=0;i<env->slots.size() && count<40;++i) {
            if (!env->bound[i]) continue;
            int id=env->layout ? env->layout->locals[i] : static_cast<int>(i);
            if (!seen.insert(id).second) continue;
            const auto& value=env->slots[i];
            if (value.is<Builtin>() || value.is<std::shared_ptr<Function>>()) continue;
            std::string shown=display(value); if (shown.size()>220) shown=shown.substr(0,220)+"…";
            if (!first) out+=','; first=false; ++count;
            out+="{\"name\":"+json_string(symbols.names[static_cast<std::size_t>(id)])+",\"value\":"+json_string(shown)+"}";
        }
    }
    return out+"]";
}
class Output : public std::streambuf {
    std::string pending; int lines=0;
    void send() {
        if (++lines>250) { pending.clear(); return; }
        host_emit("output",json_string(pending).c_str()); pending.clear();
    }
    int overflow(int c) override {
        if (c==traits_type::eof()) return traits_type::not_eof(c);
        if (c=='\n') send(); else if (pending.size()<2000) pending+=static_cast<char>(c);
        return c;
    }
public:
    void finish(){ if (!pending.empty()) send(); }
};
}
extern "C" {
EMSCRIPTEN_KEEPALIVE void milo_run(const char* source) {
    milo::sprite_count=0;
    milo::Output output; auto* old=std::cout.rdbuf(&output);
    try {
        milo::VMRuntime vm(100000);
        vm.on_trace=[](int line,const std::shared_ptr<milo::VMEnv>& env,const milo::Symbols& symbols){
            host_trace(line,milo::snapshot(env,symbols).c_str());
        };
        auto ast=milo::Parser(source).parse(); auto code=vm.compile(ast);
        vm.run(code); output.finish();
        auto variables=milo::snapshot(vm.global,vm.symbols);
        host_emit("complete",("{\"variables\":"+variables+"}").c_str());
    } catch (const milo::Error& e) {
        auto payload="{\"line\":"+std::to_string(e.line)+",\"message\":"+milo::json_string(e.what())+"}";
        host_emit("error",payload.c_str());
    } catch (const std::exception& e) {
        host_emit("error",("{\"line\":0,\"message\":"+milo::json_string(e.what())+"}").c_str());
    }
    std::cout.rdbuf(old); std::cout.clear();
}
}
